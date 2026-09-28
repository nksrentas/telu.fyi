'use client';

import { useEffect } from 'react';
import { TodayView } from '@/components/agenda/today-view';
import { PermissionWarning } from '@/components/PermissionWarning';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import Analytics from '@/lib/analytics';

function RecordingPermissionNotice() {
  const { isRecording } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone } = usePermissionCheck();
  if (isRecording || isChecking) return null;
  return (
    <PermissionWarning
      hasMicrophone={hasMicrophone}
      hasSystemAudio={hasSystemAudio}
      onRecheck={checkPermissions}
      isRechecking={isChecking}
    />
  );
}

export default function Home() {
  useEffect(() => {
    Analytics.trackPageView('home');
  }, []);

  return (
    <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-content">
      <TodayView notice={<RecordingPermissionNotice />} />
    </div>
  );
}
