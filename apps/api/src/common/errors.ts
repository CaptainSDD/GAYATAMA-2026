import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'INSUFFICIENT_DATA'
  | 'UPSTREAM_TIMEOUT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'REQUEST_FAILED'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'USERNAME_TAKEN';

export interface ErrorBody {
  statusCode: number;
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** An error with a stable code from the contract in docs/api.md. */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}

export function insufficientData(facilitiesFound: number, confidence: number): ApiError {
  return new ApiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'INSUFFICIENT_DATA',
    'Not enough mapped facilities within 1500 m to produce a reliable score.',
    { facilitiesFound, confidence: Math.round(confidence) },
  );
}

export function upstreamUnavailable(): ApiError {
  return new ApiError(
    HttpStatus.GATEWAY_TIMEOUT,
    'UPSTREAM_TIMEOUT',
    'OpenStreetMap data is temporarily unavailable and nothing is cached for this area. Please try again shortly.',
  );
}

export function unauthorized(message = 'Missing or invalid ID token.'): ApiError {
  return new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', message);
}

export function usernameTaken(username: string): ApiError {
  return new ApiError(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'This username is already taken.', { username });
}
