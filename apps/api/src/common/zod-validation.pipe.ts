import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiError } from './errors';

export class ZodValidationPipe<T extends z.ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Request validation failed', {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
}
