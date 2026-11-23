export interface AppError {
  code: string;
  category: 'validation' | 'conflict' | 'permission' | 'storage' | 'printing' | 'recovery' | 'unexpected';
  message: string;
  retryable: boolean;
  correlationId: string;
}

export interface BootstrapStatus {
  appVersion: string;
  schemaVersion: number;
  databaseReady: boolean;
  operationalReady: boolean;
}

export interface CommandMap {
  bootstrap_status: { request: undefined; response: BootstrapStatus };
}
