import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LocationScoreResult } from '@gayatama/scoring';
import type { Env } from '../config/env';
import { buildAnalysisNarrative, type AnalysisNarrative, type NarrativeContext } from './narratives';
import type { PresentedAnalysis } from './presenters';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

type NarrativeSeed = Omit<PresentedAnalysis, 'narrative'>;

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface GroqNarrative {
  headline?: unknown;
  summary?: unknown;
  positives?: unknown;
  cautions?: unknown;
  nextSteps?: unknown;
  provisional?: unknown;
}

@Injectable()
export class NarrativeService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async forAnalysis(
    result: LocationScoreResult,
    context: NarrativeContext,
    seed: NarrativeSeed,
  ): Promise<AnalysisNarrative> {
    const fallback = buildAnalysisNarrative(result, context);
    const apiKey = this.config.get('GROQ_API_KEY', { infer: true });
    if (apiKey === undefined) return fallback;

    try {
      return this.completeWithGroq(apiKey, fallback, seed);
    } catch {
      return fallback;
    }
  }

  private async completeWithGroq(
    apiKey: string,
    fallback: AnalysisNarrative,
    seed: NarrativeSeed,
  ): Promise<AnalysisNarrative> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.get('GROQ_TIMEOUT_MS', { infer: true }));
    try {
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get('GROQ_MODEL', { infer: true }),
          temperature: 0.2,
          max_tokens: 700,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'Kamu adalah analis lokasi usaha untuk kota Semarang.',
                'Tugasmu hanya menjelaskan hasil scoring yang sudah dihitung sistem.',
                'Jangan mengubah skor, jangan menambah data baru, dan jangan mengarang nama tempat.',
                'Tulis Bahasa Indonesia yang sederhana untuk pemilik usaha kecil.',
                'Return JSON valid dengan field: headline, summary, positives, cautions, nextSteps, provisional.',
              ].join(' '),
            },
            {
              role: 'user',
              content: JSON.stringify(compactSeed(seed)),
            },
          ],
        }),
      });
      if (!response.ok) return fallback;

      const body = (await response.json()) as GroqChatResponse;
      const content = body.choices?.[0]?.message?.content;
      if (content === undefined) return fallback;

      return normalizeNarrative(JSON.parse(content) as GroqNarrative, fallback);
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function compactSeed(seed: NarrativeSeed) {
  return {
    location: seed.location,
    businessType: seed.businessType,
    score: seed.score,
    components: seed.components,
    competition: {
      rawCount: seed.competition.rawCount,
      equivalentCount: seed.competition.equivalentCount,
      saturationRatio: seed.competition.saturationRatio,
      reading: seed.competition.reading,
      radiusMeters: seed.competition.radiusMeters,
      strongest: seed.competition.strongest,
      namedCompetitors: seed.competition.namedCompetitors,
    },
    strengths: seed.strengths,
    risks: seed.risks,
    warnings: seed.warnings,
    evidence: seed.evidence,
    dataSource: seed.dataSource,
  };
}

function normalizeNarrative(value: GroqNarrative, fallback: AnalysisNarrative): AnalysisNarrative {
  return {
    headline: text(value.headline) ?? fallback.headline,
    summary: text(value.summary) ?? fallback.summary,
    positives: list(value.positives, fallback.positives),
    cautions: list(value.cautions, fallback.cautions),
    nextSteps: list(value.nextSteps, fallback.nextSteps),
    provisional: typeof value.provisional === 'boolean' ? value.provisional : fallback.provisional,
    generatedBy: 'ai',
  };
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, 220);
}

function list(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.map(text).filter((item): item is string => item !== null).slice(0, 3);
  return items.length === 0 ? fallback : items;
}
