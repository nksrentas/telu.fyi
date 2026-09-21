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
): ProviderRouteFailure {
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {};
  const rawCode = typeof record.code === 'string' ? record.code : '';
  const code = ROUTE_ERROR_CODES.has(rawCode as ProviderRouteFailure['code'])
    ? rawCode as ProviderRouteFailure['code']
    : 'PROVIDER_ROUTE_UNAVAILABLE';

  return {
    code,
    capability,
    providerId: typeof record.providerId === 'string'
      ? record.providerId
      : 'Selected provider',
    modelId: typeof record.modelId === 'string' ? record.modelId : 'Unavailable',
    sanitizedOrigin: typeof record.sanitizedOrigin === 'string'
      ? record.sanitizedOrigin
      : null,
  };
}
