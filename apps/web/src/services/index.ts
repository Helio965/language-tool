import type { ApiClient } from './apiClient';
import { createDemoClient } from './demoClient';
import { createHttpClient } from './httpClient';

/** Modo escolhido por VITE_API_MODE (padrão: demo) ou por `vite --mode http`. */
export function resolveApiMode(): 'demo' | 'http' {
  return import.meta.env.MODE === 'http' || import.meta.env.VITE_API_MODE === 'http' ? 'http' : 'demo';
}

export function createApiClient(): ApiClient {
  return resolveApiMode() === 'http' ? createHttpClient(import.meta.env.VITE_API_BASE_URL || '/api') : createDemoClient();
}

export type { ApiClient } from './apiClient';
export { ApiError, errorMessage, toApiError } from './errors';
