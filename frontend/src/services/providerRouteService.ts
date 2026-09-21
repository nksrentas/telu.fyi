import { invoke } from '@tauri-apps/api/core';

export type ProviderCapability =
  | 'transcription'
  | 'summary'
  | 'document_processing'
  | 'generation';

export type LocationClass = 'local' | 'lan' | 'remote';

export type RouteValidationState =
  | 'validated'
  | 'unavailable'
  | 'materially_changed';

export interface EffectiveRoute {
  capability: ProviderCapability;
  providerId: string;
  modelId: string;
  locationClass: LocationClass | null;
  sanitizedOrigin: string | null;
  encrypted: boolean;
  validationState: RouteValidationState;
  resolvedAddresses: string[];
}

export interface AvailableEffectiveRoute extends EffectiveRoute {
  locationClass: LocationClass;
  sanitizedOrigin: string;
  validationState: 'validated';
}

export interface ProviderRouteFailure {
  code: 'PROVIDER_ROUTE_UNAVAILABLE' | 'PROVIDER_ROUTE_MATERIALLY_CHANGED';
  capability: ProviderCapability;
  providerId: string;
  modelId: string;
  sanitizedOrigin: string | null;
}

const ROUTE_ERROR_CODES = new Set<ProviderRouteFailure['code']>([
  'PROVIDER_ROUTE_UNAVAILABLE',
  'PROVIDER_ROUTE_MATERIALLY_CHANGED',
]);

export async function getCurrentProviderRoute(
  capability: ProviderCapability,
): Promise<EffectiveRoute> {
  return invoke<EffectiveRoute>('get_current_provider_route', { capability });
}

export async function validateProviderRoute(
  expectedRoute: EffectiveRoute,
): Promise<EffectiveRoute> {
  return invoke<EffectiveRoute>('validate_provider_route', { expectedRoute });
}

function routeErrorRecord(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return routeErrorRecord(error.message);
  }
  if (typeof error === 'object' && error !== null) {
    return error as Record<string, unknown>;
  }

  const message = String(error ?? '');
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Tauri can also return a stable error code as a plain string.
  }

  if (message.includes('PROVIDER_ROUTE_MATERIALLY_CHANGED')) {
    return { code: 'PROVIDER_ROUTE_MATERIALLY_CHANGED' };
  }
  if (message.includes('PROVIDER_ROUTE_UNAVAILABLE')) {
    return { code: 'PROVIDER_ROUTE_UNAVAILABLE' };
  }
  return {};
}

export function isProviderRouteFailureError(error: unknown): boolean {
  const code = routeErrorRecord(error).code;
  return typeof code === 'string'
    && ROUTE_ERROR_CODES.has(code as ProviderRouteFailure['code']);
}

export function isRouteAvailable(
  route: EffectiveRoute | null,
): route is AvailableEffectiveRoute {
  return Boolean(
    route
    && route.validationState === 'validated'
    && route.locationClass
    && route.sanitizedOrigin,
  );
}

export function normalizeProviderRouteFailure(
  error: unknown,
  capability: ProviderCapability,
  expectedRoute?: EffectiveRoute | null,
): ProviderRouteFailure {
  const record = routeErrorRecord(error);
  const rawCode = typeof record.code === 'string' ? record.code : '';
  const code = ROUTE_ERROR_CODES.has(rawCode as ProviderRouteFailure['code'])
    ? rawCode as ProviderRouteFailure['code']
    : 'PROVIDER_ROUTE_UNAVAILABLE';

  return {
    code,
    capability,
    providerId: typeof record.providerId === 'string'
      ? record.providerId
      : expectedRoute?.providerId ?? 'Selected provider',
    modelId: typeof record.modelId === 'string'
      ? record.modelId
      : expectedRoute?.modelId ?? 'Unavailable',
    sanitizedOrigin: typeof record.sanitizedOrigin === 'string'
      ? record.sanitizedOrigin
      : expectedRoute?.sanitizedOrigin ?? null,
  };
}
