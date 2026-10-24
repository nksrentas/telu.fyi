'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PreparationPage } from '@/components/preparation/preparation-page';

function PreparationRoute() {
  const id = useSearchParams().get('id');
  return id ? <PreparationPage key={id} id={id} /> : null;
}

export default function PreparationRoutePage() {
  return (
    <Suspense>
      <PreparationRoute />
    </Suspense>
  );
}
