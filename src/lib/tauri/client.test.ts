import { describe, it, expect, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: vi.fn() }));
import { callDesktop, normalizeError } from './client';

describe('desktop boundary', () => {
  it('does not substitute a browser mock for SQLite', async () => {
    await expect(callDesktop('bootstrap_status')).rejects.toMatchObject({ code: 'DESKTOP_REQUIRED', retryable: false });
  });
  it('does not expose raw backend exceptions', () => {
    const result = normalizeError(new Error('SQL failed at private path'));
    expect(result.message).not.toContain('SQL');
    expect(result.code).toBe('UNEXPECTED_ERROR');
  });
});
