'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PreparationPage } from '@/components/preparation/preparation-page';
import type { SourceTarget } from '@/components/preparation/source-viewer';

function sourceFromParams(params: URLSearchParams): SourceTarget | null {
  const versionId = params.get('source');
  if (!versionId) return null;
  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  const hasLocator = params.has('start') && params.has('end') && Number.isInteger(start) && Number.isInteger(end) && 0 <= start && start < end;
  return hasLocator ? { versionId, locator: { start, end } } : { versionId };
}

function PreparationRoute() {
  const params = useSearchParams();
  const id = params.get('id');
  return id ? <PreparationPage key={id} id={id} initialSource={sourceFromParams(params)} /> : null;
}

export default function PreparationRoutePage() {
  return (
    <Suspense>
      <PreparationRoute />
    </Suspense>
  );
}
