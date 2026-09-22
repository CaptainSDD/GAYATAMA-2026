import type { Firestore } from 'firebase-admin/firestore';
import { AuthService } from '../src/auth/auth.service';
import { ApiError } from '../src/common/errors';
import { FakeFirestore } from './fixtures';

function setup() {
  const firestore = new FakeFirestore();
  const service = new AuthService(firestore as unknown as Firestore);
  return { service, firestore };
}

describe('AuthService.registerProfile', () => {
  it('creates a user profile and reserves the lowercased username', async () => {
    const { service, firestore } = setup();
    const profile = await service.registerProfile('uid-1', 'budi@example.com', { username: 'Budi87' });

    expect(profile).toEqual({
      uid: 'uid-1',
      email: 'budi@example.com',
      username: 'Budi87',
      createdAt: profile.createdAt,
      // A brand new profile has never left the documented baseline.
      weights: null,
      // No payment behind this — every new account starts free.
      plan: 'free',
    });
    expect(firestore.usernames.get('budi87')).toEqual({ uid: 'uid-1' });
    expect(firestore.users.get('uid-1')).toMatchObject({ email: 'budi@example.com', username: 'Budi87', plan: 'free' });
  });

  it('treats a retry by the same user as a no-op rather than a conflict', async () => {
    const { service, firestore } = setup();
    await service.registerProfile('uid-1', 'budi@example.com', { username: 'Budi' });

    const profile = await service.registerProfile('uid-1', 'budi@example.com', { username: 'Budi' });

    expect(profile.username).toBe('Budi');
    expect(firestore.usernames.get('budi')).toEqual({ uid: 'uid-1' });
  });

  it('rejects a username that is already taken, case-insensitively', async () => {
    const { service } = setup();
    await service.registerProfile('uid-1', 'a@example.com', { username: 'Budi' });

    await expect(service.registerProfile('uid-2', 'b@example.com', { username: 'budi' })).rejects.toThrow(ApiError);
  });

  it('reports USERNAME_TAKEN with a 409 status', async () => {
    const { service } = setup();
    await service.registerProfile('uid-1', 'a@example.com', { username: 'budi' });

    try {
      await service.registerProfile('uid-2', 'b@example.com', { username: 'budi' });
      throw new Error('expected registerProfile to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('USERNAME_TAKEN');
      expect((error as ApiError).getStatus()).toBe(409);
    }
  });

  it('fails clearly when Firestore is not configured', async () => {
    const service = new AuthService(null);
    await expect(service.registerProfile('uid-1', null, { username: 'budi' })).rejects.toThrow(ApiError);
  });
});

describe('AuthService plan', () => {
  it('defaults a freshly registered profile to the free plan', async () => {
    const { service } = setup();
    await service.registerProfile('uid-1', 'a@example.com', { username: 'budi' });

    const profile = await service.getProfile('uid-1', 'a@example.com');
    expect(profile?.plan).toBe('free');
  });

  it('setPlan is read back by getProfile — the whole "upgrade" flow, no payment involved', async () => {
    const { service } = setup();
    await service.registerProfile('uid-1', 'a@example.com', { username: 'budi' });

    await service.setPlan('uid-1', 'premium');

    expect((await service.getProfile('uid-1', 'a@example.com'))?.plan).toBe('premium');
  });

  it('rejects setPlan for an account with no profile yet', async () => {
    const { service } = setup();
    await expect(service.setPlan('uid-404', 'premium')).rejects.toThrow(ApiError);
  });
});
