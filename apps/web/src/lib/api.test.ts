import { describe, expect, it } from 'vitest';
import { ApiError, shouldRetry, toApiError } from './api';
import { errorMessage, isRetryable } from './copy';

describe('API errors', () => {
  it('keeps the code and details from the documented error body', () => {
    const error = toApiError(422, {
      statusCode: 422,
      error: 'INSUFFICIENT_DATA',
      message: 'Not enough mapped facilities within 1500 m to produce a reliable score.',
      details: { facilitiesFound: 3, confidence: 22 },
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INSUFFICIENT_DATA');
    expect(error.details).toEqual({ facilitiesFound: 3, confidence: 22 });
    expect(errorMessage(error)).toContain('confidence 22/100');
    expect(isRetryable(error)).toBe(false);
  });

  it('handles a body that is not an API error', () => {
    const error = toApiError(502, null);
    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(502);
  });

  it('gives a readable message for every documented code', () => {
    for (const code of ['VALIDATION_FAILED', 'RATE_LIMITED', 'UPSTREAM_TIMEOUT', 'NETWORK_ERROR']) {
      expect(errorMessage(new ApiError(400, code, ''))).not.toBe('');
    }
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});

describe('shouldRetry', () => {
  const failure = (status: number, code = 'X') => new ApiError(status, code, '');

  it('retries an unreachable API or an unexpected server error once', () => {
    expect(shouldRetry(0, failure(0, 'NETWORK_ERROR'))).toBe(true);
    expect(shouldRetry(0, failure(500))).toBe(true);
    expect(shouldRetry(1, failure(500))).toBe(false);
  });

  it('never retries a gateway timeout, a rate limit, or a client error', () => {
    expect(shouldRetry(0, failure(504, 'UPSTREAM_TIMEOUT'))).toBe(false);
    expect(shouldRetry(0, failure(429, 'RATE_LIMITED'))).toBe(false);
    expect(shouldRetry(0, failure(422, 'INSUFFICIENT_DATA'))).toBe(false);
    expect(shouldRetry(0, new Error('not an API error'))).toBe(false);
  });
});
