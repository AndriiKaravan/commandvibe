import { UnauthorizedException } from '@nestjs/common';
import { createMemoryRepositories } from '../data/memory/memory-repositories';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let now: number;
  let service: SessionService;

  beforeEach(() => {
    now = Date.UTC(2026, 11, 1, 9, 0, 0);
    service = new SessionService(createMemoryRepositories().sessions, 'test-signing-key-0123456789abcdef', () => new Date(now));
  });

  const member = { kind: 'member' as const, id: 'm1', groupId: 'g1' };

  it('should issue tokens that verify', async () => {
    const tokens = await service.issue(member, 'test');
    const verified = await service.verifyAccess(tokens.accessToken);
    expect(verified.subject).toEqual(member);
    expect(verified.expiresAt).toBe(Math.floor(now / 1000) + 15 * 60);
    expect(tokens.expiresAt).toBe(verified.expiresAt);
  });

  it('should reject an access token after revoke', async () => {
    const tokens = await service.issue(member, 'test');
    const { sessionId } = await service.verifyAccess(tokens.accessToken);
    await service.revoke(sessionId);
    await expect(service.verifyAccess(tokens.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject a tampered access token', async () => {
    const tokens = await service.issue(member, 'test');
    const [header, payload, signature] = tokens.accessToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: 'm2' }),
    ).toString('base64url');
    await expect(service.verifyAccess(`${header}.${forged}.${signature}`)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should rotate the refresh token', async () => {
    const first = await service.issue(member, 'test');
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.verifyAccess(second.accessToken)).resolves.toMatchObject({ subject: member });
  });

  it('should revoke the whole session when an old refresh token is reused', async () => {
    const first = await service.issue(member, 'test');
    const second = await service.refresh(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyAccess(second.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject an expired access token', async () => {
    const tokens = await service.issue(member, 'test');
    now += (15 * 60 + 1) * 1000;
    await expect(service.verifyAccess(tokens.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should revoke every session of a subject', async () => {
    const phone = await service.issue(member, 'phone');
    const laptop = await service.issue(member, 'laptop');
    await service.revokeSubject('m1');
    await expect(service.verifyAccess(phone.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(laptop.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
