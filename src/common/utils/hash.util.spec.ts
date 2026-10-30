import { HashUtil } from './hash.util';

describe('HashUtil', () => {
  it('should hash and verify passwords with Argon2id', async () => {
    const rawPassword = 'SuperSecretPassword2026!';
    const hash = await HashUtil.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(rawPassword);

    const isValid = await HashUtil.verifyPassword(hash, rawPassword);
    expect(isValid).toBe(true);

    const isInvalid = await HashUtil.verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('should generate a 6-digit numeric code when requested', () => {
    const code = HashUtil.generateNumericCode(6);
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('should generate a 5-digit numeric handover code', () => {
    const code = HashUtil.generateNumericCode(5);
    expect(code).toHaveLength(5);
    expect(/^\d{5}$/.test(code)).toBe(true);
  });

  it('should hash tokens deterministically with SHA-256', () => {
    const code = '123456';
    const hash1 = HashUtil.hashToken(code);
    const hash2 = HashUtil.hashToken(code);

    expect(hash1).toEqual(hash2);
    expect(HashUtil.safeCompare(hash1, hash2)).toBe(true);
  });
});
