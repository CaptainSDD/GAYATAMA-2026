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
  | 'EMAIL_NOT_VERIFIED'
  | 'PREMIUM_REQUIRED'
  | 'USERNAME_TAKEN'
  | 'LOCATION_NOT_ELIGIBLE'
  | 'MAIL_NOT_CONFIGURED';

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

/** `location` names the side that failed, so a two-location comparison can say which one. */
export function insufficientData(facilitiesFound: number, confidence: number, location?: 'a' | 'b'): ApiError {
  return new ApiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'INSUFFICIENT_DATA',
    'Not enough mapped facilities within 1500 m to produce a reliable score.',
    { facilitiesFound, confidence: Math.round(confidence), ...(location !== undefined && { location }) },
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

/**
 * 403, not 401: the caller proved who they are, they just have not proved the
 * address is theirs. A 401 would tell the client to sign in again, which is
 * exactly the wrong remedy.
 */
export function emailNotVerified(): ApiError {
  return new ApiError(
    HttpStatus.FORBIDDEN,
    'EMAIL_NOT_VERIFIED',
    'Verifikasi alamat email Anda dulu untuk memakai fitur ini.',
  );
}

/**
 * 403, not 401: the caller proved who they are, they just aren't on a plan
 * that includes this feature. A 401 would tell the client to sign in again,
 * which would not change the answer.
 */
export function premiumRequired(): ApiError {
  return new ApiError(
    HttpStatus.FORBIDDEN,
    'PREMIUM_REQUIRED',
    'Fitur ini hanya tersedia untuk akun premium.',
  );
}

/** Distinct from REQUEST_FAILED so the browser knows it may fall back to Firebase's own sender. */
export function mailNotConfigured(): ApiError {
  return new ApiError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'MAIL_NOT_CONFIGURED',
    'No mail transport is configured on the server, so it cannot send the verification email itself.',
  );
}

export function mailSendFailed(): ApiError {
  return new ApiError(
    HttpStatus.BAD_GATEWAY,
    'REQUEST_FAILED',
    'Email verifikasi gagal dikirim. Coba lagi sebentar lagi.',
  );
}

export function usernameTaken(username: string): ApiError {
  return new ApiError(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'This username is already taken.', { username });
}

export function unknownKecamatan(kecamatanId: string): ApiError {
  return new ApiError(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_FAILED',
    `Unknown kecamatanId: ${kecamatanId}`,
    { kecamatanId },
  );
}

export function unsuitableLocation(reason: 'water' | 'wetland' | 'aquaculture'): ApiError {
  const labels = { water: 'perairan', wetland: 'lahan basah', aquaculture: 'area akuakultur' } as const;
  return new ApiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'LOCATION_NOT_ELIGIBLE',
    `Titik ini berada di ${labels[reason]} yang tidak cocok untuk lokasi usaha.`,
    { reason },
  );
}
