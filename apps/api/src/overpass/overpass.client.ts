import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { OverpassElement } from './overpass-element';

const USER_AGENT = 'GAYATAMA/0.1 (+https://github.com/CaptainSDD/GAYATAMA-2026)';
const RETRY_DELAY_MS = 1500;
/**
 * Overpass gives each IP address two query slots (see /api/status) and answers
 * 429 beyond that, so this client never runs more than two queries at once.
 */
const MAX_CONCURRENT_QUERIES = 2;

export class OverpassRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * Thin client for the Overpass API. Overpass is a volunteer-funded shared
 * service: requests identify GAYATAMA, run at most two at a time, and a
 * rate-limited or overloaded response is retried once after a pause rather
 * than hammered.
 */
@Injectable()
export class OverpassClient {
  private readonly logger = new Logger(OverpassClient.name);
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Server-side query timeout, kept below the client timeout so Overpass gives up first. */
  get queryTimeoutSeconds(): number {
    return Math.max(5, Math.floor(this.config.get('OVERPASS_TIMEOUT_MS', { infer: true }) / 1000) - 5);
  }

  async query(query: string): Promise<OverpassElement[]> {
    try {
      return await this.withSlot(() => this.send(query));
    } catch (error) {
      if (!(error instanceof OverpassRequestError) || !error.retryable) throw error;
      this.logger.warn(`${error.message}; retrying once`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.withSlot(() => this.send(query));
    }
  }

  /** Waits for a free query slot, runs the task, then hands the slot to the next waiting query. */
  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < MAX_CONCURRENT_QUERIES) {
      this.active += 1;
    } else {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next !== undefined) next();
      else this.active -= 1;
    }
  }

  private async send(query: string): Promise<OverpassElement[]> {
    let response: Response;
    try {
      response = await fetch(this.config.get('OVERPASS_URL', { infer: true }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(this.config.get('OVERPASS_TIMEOUT_MS', { infer: true })),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new OverpassRequestError(timedOut ? 'Overpass request timed out' : 'Overpass request failed', !timedOut);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new OverpassRequestError(`Overpass responded ${response.status}`, retryable);
    }

    const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
    if (body.remark !== undefined && /runtime error|timed out|out of memory/i.test(body.remark)) {
      throw new OverpassRequestError(`Overpass query failed: ${body.remark}`, false);
    }
    return body.elements ?? [];
  }
}
