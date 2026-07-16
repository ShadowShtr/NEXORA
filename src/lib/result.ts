export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type Result<T> =
  { ok: true; value: T } | { ok: false; error: { code: AppErrorCode; message: string } };
