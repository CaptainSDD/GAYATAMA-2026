import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConcurrencyLimiter } from '../common/concurrency-limiter';
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

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** The low-level reason a request failed, such as UND_ERR_CONNECT_TIMEOUT or ENOTFOUND. */
function causeOf(error: unknown): string {
  const cause: unknown = error instanceof Error ? error.cause : undefined;
  if (typeof cause === 'object' && cause !== null) {
    const { code, message } = cause as { code?: unknown; message?: unknown };
    if (typeof code === 'string') return code;
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : String(error);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thin client for the Overpass API. Overpass is a volunteer-funded shared
 * service: requests identify GAYATAMA and run at most two at a time. A
 * rate-limited, overloaded or unreachable instance is not hammered — the query
 * moves on to the next configured instance or, with only one instance, is
 * retried once after a pause.
 */
@Injectable()
export class OverpassClient {
  private readonly logger = new Logger(OverpassClient.name);
  private readonly limiter = new ConcurrencyLimiter(MAX_CONCURRENT_QUERIES);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Server-side query timeout, kept below the client timeout so Overpass gives up first. */
  get queryTimeoutSeconds(): number {
    return Math.max(5, Math.floor(this.config.get('OVERPASS_TIMEOUT_MS', { infer: true }) / 1000) - 5);
  }

  /** OVERPASS_URL, then each distinct fallback. */
  get endpoints(): string[] {
    const primary = this.config.get('OVERPASS_URL', { infer: true });
    const fallbacks = this.config.get('OVERPASS_FALLBACK_URLS', { infer: true }) ?? [];
    const distinct = fallbacks.filter((url, index) => url !== primary && fallbacks.indexOf(url) === index);
    return [primary, ...distinct];
  }

  async query(
    query: string,
    timeoutMs = this.config.get('OVERPASS_TIMEOUT_MS', { infer: true }),
  ): Promise<OverpassElement[]> {
    const endpoints = this.endpoints;
    const attempts = endpoints.length > 1 ? endpoints : [...endpoints, ...endpoints];
    let lastError: OverpassRequestError | undefined;

    for (const [index, url] of attempts.entries()) {
      if (lastError !== undefined) {
        const sameInstance = url === attempts[index - 1];
        this.logger.warn(`${lastError.message}; ${sameInstance ? 'retrying once' : `trying ${hostOf(url)}`}`);
        if (sameInstance) await pause(RETRY_DELAY_MS);
      }
      try {
        return await this.limiter.run(() => this.send(url, query, timeoutMs));
      } catch (error) {
        if (!(error instanceof OverpassRequestError) || !error.retryable) throw error;
        lastError = error;
      }
    }
    throw lastError ?? new OverpassRequestError('No Overpass instance is configured', false);
  }

  private async send(url: string, query: string, timeoutMs: number): Promise<OverpassElement[]> {
    const host = hostOf(url);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw timedOut
        ? new OverpassRequestError(`Overpass request to ${host} timed out`, false)
        : new OverpassRequestError(`Overpass request to ${host} failed (${causeOf(error)})`, true);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new OverpassRequestError(`Overpass responded ${response.status} (${host})`, retryable);
    }

    const body = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
    if (body.remark !== undefined && /runtime error|timed out|out of memory/i.test(body.remark)) {
      throw new OverpassRequestError(`Overpass query failed on ${host}: ${body.remark}`, false);
    }
    return body.elements ?? [];
  }
}
