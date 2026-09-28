'use client';

import { useEffect } from 'react';
import { ReviewView } from '@/components/agenda/review-view';
import Analytics from '@/lib/analytics';

export default function ReviewPage() {
  useEffect(() => {
    Analytics.trackPageView('review');
  }, []);

  return (
    <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-content">
      <ReviewView />
    </div>
  );
}
