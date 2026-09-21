'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, Laptop, LoaderCircle, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  AvailableEffectiveRoute,
  EffectiveRoute,
  LocationClass,
  ProviderCapability,
  ProviderRouteFailure,
  getCurrentProviderRoute,
  isRouteAvailable,
  normalizeProviderRouteFailure,
} from '@/services/providerRouteService';

export type ProviderRouteViewState =
  | { status: 'loading'; route: null; failure: null }
  | { status: 'validated'; route: AvailableEffectiveRoute; failure: null }
  | {
    status: 'unavailable' | 'materially_changed';
    route: EffectiveRoute | null;
    failure: ProviderRouteFailure;
  };

interface ProviderBoundaryProps {
  capability: Extract<ProviderCapability, 'transcription' | 'summary'>;
  refreshKey?: string | number;
  className?: string;
  onRouteStateChange?: (state: ProviderRouteViewState) => void;
}

const locationPresentation: Record<LocationClass, {
  label: 'Local' | 'LAN' | 'Remote';
  Icon: typeof Laptop;
}> = {
  local: { label: 'Local', Icon: Laptop },
  lan: { label: 'LAN', Icon: Network },
  remote: { label: 'Remote', Icon: Cloud },
};

const capabilityLabel = (capability: ProviderCapability) => {
  switch (capability) {
    case 'transcription':
      return 'Transcription';
    case 'summary':
      return 'Summary';
    case 'document_processing':
      return 'Document processing';
    case 'generation':
      return 'Generation';
  }
};

export function middleTruncate(value: string, maxLength = 48) {
  if (value.length <= maxLength) return value;
  const retainedLength = maxLength - 1;
  const startLength = Math.ceil(retainedLength / 2);
  const endLength = Math.floor(retainedLength / 2);
  return `${value.slice(0, startLength)}…${value.slice(-endLength)}`;
}

export function ProviderBoundary({
  capability,
  refreshKey,
  className,
  onRouteStateChange,
}: ProviderBoundaryProps) {
  const [state, setState] = useState<ProviderRouteViewState>({
    status: 'loading',
    route: null,
    failure: null,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const stateChangeRef = useRef(onRouteStateChange);

  useEffect(() => {
    stateChangeRef.current = onRouteStateChange;
  }, [onRouteStateChange]);

  useEffect(() => {
    let active = true;
    const loadingState: ProviderRouteViewState = {
      status: 'loading',
      route: null,
      failure: null,
    };
    setState(loadingState);
    setIsExpanded(false);
    stateChangeRef.current?.(loadingState);

    void getCurrentProviderRoute(capability)
      .then((route) => {
        if (!active) return;
        if (isRouteAvailable(route)) {
          const validatedState: ProviderRouteViewState = {
            status: 'validated',
            route,
            failure: null,
          };
          setState(validatedState);
          stateChangeRef.current?.(validatedState);
          return;
        }

        const failure = normalizeProviderRouteFailure(
          { code: route.validationState === 'materially_changed'
            ? 'PROVIDER_ROUTE_MATERIALLY_CHANGED'
            : 'PROVIDER_ROUTE_UNAVAILABLE',
          providerId: route.providerId,
          modelId: route.modelId,
          sanitizedOrigin: route.sanitizedOrigin },
          capability,
        );
        const unavailableState: ProviderRouteViewState = {
          status: route.validationState === 'materially_changed'
            ? 'materially_changed'
            : 'unavailable',
          route,
          failure,
        };
        setState(unavailableState);
        stateChangeRef.current?.(unavailableState);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const failure = normalizeProviderRouteFailure(error, capability);
        const unavailableState: ProviderRouteViewState = {
          status: failure.code === 'PROVIDER_ROUTE_MATERIALLY_CHANGED'
            ? 'materially_changed'
            : 'unavailable',
          route: null,
          failure,
        };
        setState(unavailableState);
        stateChangeRef.current?.(unavailableState);
      });

    return () => {
      active = false;
    };
  }, [capability, refreshKey]);

  const display = useMemo(() => {
    if (state.status !== 'validated') return null;
    return locationPresentation[state.route.locationClass];
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div
        className={cn('rounded-lg border border-border bg-card px-4 py-3', className)}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{capabilityLabel(capability)} route: Checking destination…</span>
        </div>
      </div>
    );
  }

  if (state.status !== 'validated' || !display) {
    const title = `${capabilityLabel(capability)} provider unavailable`;
    return (
      <Alert variant="destructive" className={cn('bg-card', className)}>
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          The selected route could not be validated. Your provider choice is preserved, and no data was sent to another provider.
        </AlertDescription>
      </Alert>
    );
  }

  const { route } = state;
  const { Icon, label } = display;
  const origin = route.sanitizedOrigin;
  const canExpand = origin.length > 48;
  const detailId = `${capability}-provider-route-origin`;

  return (
    <div className={cn('rounded-lg border border-border bg-card px-4 py-3 text-foreground', className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{capabilityLabel(route.capability)}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs font-normal text-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          className={cn(
            'min-w-0 max-w-full rounded-sm text-left text-sm text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            canExpand ? 'cursor-pointer' : 'cursor-text',
          )}
          aria-expanded={isExpanded}
          aria-controls={canExpand ? detailId : undefined}
          onClick={() => canExpand && setIsExpanded((current) => !current)}
        >
          {middleTruncate(origin)}
        </button>
        {route.locationClass === 'lan' && !route.encrypted && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Not encrypted
          </span>
        )}
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-label="Route validated" />
      </div>
      <p className="mt-2 break-words text-xs text-muted-foreground">
        {route.providerId} · {route.modelId} · Validated
      </p>
      {canExpand && isExpanded && (
        <div id={detailId} className="mt-2 border-t border-border pt-2">
          <p className="text-xs font-semibold text-foreground">Full destination</p>
          <p className="mt-1 select-text break-all text-xs text-muted-foreground">
            {route.sanitizedOrigin}
          </p>
        </div>
      )}
    </div>
  );
}
