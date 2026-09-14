import { ConfigService } from '@nestjs/config';
import { NarrativeService } from '../src/analysis/narrative.service';
import type { AnalysisNarrative, NarrativeContext } from '../src/analysis/narratives';
import type { PresentedAnalysis } from '../src/analysis/presenters';
import type { Env } from '../src/config/env';

const fallbackResult = {
  businessType: 'laundry',
  score: { value: 66, band: 'moderately_suitable', confidence: 70, margin: 10, range: [56, 76] },
  components: {
    demandFit: 70,
    accessibility: 60,
    competition: 61,
    supportingFacility: 65,
    risk: 50,
  },
  competition: {
    reading: 'healthy',
  },
} as const;

const context: NarrativeContext = {
  siteAvailable: true,
  stale: false,
  placesStatus: 'used',
};

const seed = {
  location: { lat: -7.005, lng: 110.435 },
  businessType: 'laundry',
  score: fallbackResult.score,
  components: {},
  competition: {
    rawCount: 3,
    equivalentCount: 2.5,
    density: 'medium',
    saturationRatio: 0.6,
    reading: 'healthy',
    radiusMeters: 1500,
    strongest: [],
    namedCompetitors: [],
  },
  strengths: [],
  risks: [],
  warnings: [],
  evidence: { facilityCount: 30, zones: { a: 3, b: 8, c: 19 } },
  dataSource: {},
} as unknown as PresentedAnalysis;

function config(values: Partial<Env>) {
  return {
    get: (key: keyof Env) => values[key],
  } as ConfigService<Env, true>;
}

describe('NarrativeService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses the built-in narrative when Groq is not configured', async () => {
    const service = new NarrativeService(config({ GROQ_API_KEY: undefined }));

    const narrative = await service.forAnalysis(fallbackResult as never, context, seed);

    expect(narrative.headline).toContain('laundry');
    expect(narrative.summary).not.toBe('');
    expect(narrative.generatedBy).toBe('template');
  });

  it('uses a valid Groq JSON narrative when configured', async () => {
    const llmNarrative: AnalysisNarrative = {
      headline: 'Lokasi ini cukup menarik untuk laundry',
      summary: 'Pelanggan sekitar terlihat cukup kuat, tetapi tetap perlu survei lapangan.',
      positives: ['Ada permukiman dan aktivitas sekitar yang mendukung.'],
      cautions: ['Persaingan tetap perlu dicek langsung.'],
      nextSteps: ['Survei pagi dan sore sebelum menyewa tempat.'],
      provisional: false,
      generatedBy: 'template',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(llmNarrative) } }] }),
    } satisfies Partial<Response> as Response);
    const service = new NarrativeService(
      config({ GROQ_API_KEY: 'gsk_test', GROQ_MODEL: 'llama-3.1-8b-instant', GROQ_TIMEOUT_MS: 8000 }),
    );

    await expect(service.forAnalysis(fallbackResult as never, context, seed)).resolves.toEqual({
      ...llmNarrative,
      generatedBy: 'ai',
    });
  });

  it('falls back when Groq fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const service = new NarrativeService(
      config({ GROQ_API_KEY: 'gsk_test', GROQ_MODEL: 'llama-3.1-8b-instant', GROQ_TIMEOUT_MS: 8000 }),
    );

    const narrative = await service.forAnalysis(fallbackResult as never, context, seed);

    expect(narrative.headline).toContain('laundry');
    expect(narrative.generatedBy).toBe('template');
  });
});
