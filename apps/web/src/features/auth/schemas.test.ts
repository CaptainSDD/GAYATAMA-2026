import { describe, expect, it } from 'vitest';
import { fieldErrors, loginSchema, signupSchema } from './schemas';

describe('signupSchema', () => {
  it('accepts a valid signup', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: 'budi_87', password: 'sandi1234' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = signupSchema.safeParse({ email: 'not-an-email', username: 'budi', password: 'sandi1234' });
    expect(result.success).toBe(false);
  });

  it('rejects a username starting with a digit', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: '1budi', password: 'sandi1234' });
    expect(result.success).toBe(false);
  });

  it('rejects a username shorter than 3 characters', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: 'ab', password: 'sandi1234' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a number', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: 'budi', password: 'sandisaja' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: 'budi', password: 'a1b2' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts email and any non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'budi@example.com', password: 'x' }).success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'budi@example.com', password: '' }).success).toBe(false);
  });
});

describe('fieldErrors', () => {
  it('keeps the first error per field, keyed by field name', () => {
    const result = signupSchema.safeParse({ email: '', username: '1', password: 'x' });
    const errors = fieldErrors(result);
    expect(Object.keys(errors)).toEqual(['email', 'username', 'password']);
  });

  it('returns an empty object for a successful parse', () => {
    const result = signupSchema.safeParse({ email: 'budi@example.com', username: 'budi', password: 'sandi1234' });
    expect(fieldErrors(result)).toEqual({});
  });
});
