import { invoke, isTauri } from '@tauri-apps/api/core';
import type { AppError, CommandMap } from '@/types/desktop';

export function normalizeError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null &&
      'code' in error && typeof error.code === 'string' &&
      'message' in error && typeof error.message === 'string' &&
      'category' in error && 'retryable' in error && 'correlationId' in error) {
    return error as AppError;
  }
  return {
    code: 'UNEXPECTED_ERROR', category: 'unexpected',
    message: 'The operation could not be confirmed. Retry the status check.',
    retryable: true, correlationId: crypto.randomUUID(),
  };
}

export async function callDesktop<K extends keyof CommandMap>(command: K): Promise<CommandMap[K]['response']> {
  if (!isTauri()) {
    throw {
      code: 'DESKTOP_REQUIRED', category: 'validation',
      message: 'Open the Windows desktop application to connect to local storage.',
      retryable: false, correlationId: crypto.randomUUID(),
    } satisfies AppError;
  }
  try { return await invoke<CommandMap[K]['response']>(command); }
  catch (error) { throw normalizeError(error); }
}
