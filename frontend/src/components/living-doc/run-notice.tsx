'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Cloud, Laptop, Network, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/telu-ui/icon';
import type { ProviderRouteViewState } from '@/components/ProviderBoundary';
import type { LocationClass } from '@/services/providerRouteService';
import { cn } from '@/lib/utils';

export const ROUTE_UNAVAILABLE_COPY =
  "Your Summary provider couldn't be validated. Nothing was sent. Check it in Settings.";

export const LOCATION: Record<LocationClass, { label: string; icon: LucideIcon }> = {
  local: { label: 'Local', icon: Laptop },
  lan: { label: 'LAN', icon: Network },
  remote: { label: 'Remote', icon: Cloud },
};

interface RunNoticeProps {
  routeState: ProviderRouteViewState;
  blocked?: boolean;
  action?: ReactNode;
  className?: string;
}

function UnavailableNotice({ action, className }: { action?: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <div role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-label-2">
        <span>{ROUTE_UNAVAILABLE_COPY}</span>
        <Button asChild variant="plain" size="sm">
          <Link href="/settings">Open Settings</Link>
        </Button>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function RunNotice({ routeState, blocked = false, action, className }: RunNoticeProps) {
  if (routeState.status === 'loading') {
    return <div className={cn('flex min-h-[18px] items-center justify-end gap-2', className)}>{action}</div>;
  }
  if (routeState.status !== 'validated' || blocked) {
    return <UnavailableNotice action={action} className={className} />;
  }
  const { route } = routeState;
  const location = LOCATION[route.locationClass];
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <p className="m-0 flex min-w-0 items-center gap-1.5 text-[12px] text-label-2">
        <Icon icon={location.icon} size={13} className="shrink-0 text-label-3" />
        <span className="min-w-0 truncate">
          Uses your Summary model · {location.label} · {route.sanitizedOrigin}
        </span>
        {route.locationClass === 'lan' && !route.encrypted && (
          <span className="shrink-0 text-coral-ink">· Not encrypted</span>
        )}
      </p>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
