"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MeetingSummary, SummaryProcessResponse } from '@/types';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TranscriptPanel } from '@/components/MeetingDetails/TranscriptPanel';
import { SummaryPanel } from '@/components/MeetingDetails/SummaryPanel';
import { MeetingDetailsSplitView, type MeetingDetailsTab } from '@/components/MeetingDetails/MeetingDetailsSplitView';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { MeetingCompleteness } from '@/components/MeetingCompleteness';

// Custom hooks
import { useMeetingData } from '@/hooks/meeting-details/useMeetingData';
import { useSummaryGeneration } from '@/hooks/meeting-details/useSummaryGeneration';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { useCopyOperations } from '@/hooks/meeting-details/useCopyOperations';
import { useMeetingOperations } from '@/hooks/meeting-details/useMeetingOperations';
import { useConfig } from '@/contexts/ConfigContext';
import {
  ProviderBoundary,
  ProviderRouteFailureAlert,
  type ProviderRouteViewState,
} from '@/components/ProviderBoundary';
import {
  isRouteAvailable,
  normalizeProviderRouteFailure,
  validateProviderRoute,
  type ProviderRouteFailure,
} from '@/services/providerRouteService';

export default function PageContent({
  meeting,
  summaryData,
  initialSummary,
  shouldAutoGenerate = false,
  onAutoGenerateComplete,
  onMeetingUpdated,
  onRefetchTranscripts,
  // Pagination props for efficient transcript loading
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
}: {
  meeting: any;
  summaryData: MeetingSummary | null;
  initialSummary: SummaryProcessResponse | null;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  onMeetingUpdated?: () => Promise<void>;
  onRefetchTranscripts?: () => Promise<void>;
  // Pagination props
  segments?: any[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
}) {
  console.log('📄 PAGE CONTENT: Initializing with data:', {
    meetingId: meeting.id,
    summaryDataKeys: summaryData ? Object.keys(summaryData) : null,
    transcriptsCount: meeting.transcripts?.length
  });

  // State
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const isRecording = false;
  const [activeTab, setActiveTab] = useState<MeetingDetailsTab>('transcript');
  const [summaryRouteState, setSummaryRouteState] = useState<ProviderRouteViewState>({
    status: 'loading',
    route: null,
    failure: null,
  });
  const [summaryRouteFailure, setSummaryRouteFailure] = useState<ProviderRouteFailure | null>(null);
  const [isSummaryRouteRetrying, setIsSummaryRouteRetrying] = useState(false);
  const [summaryRouteRefreshKey, setSummaryRouteRefreshKey] = useState(0);

  // Ref to store the modal open function from SummaryGeneratorButtonGroup
  const openModelSettingsRef = useRef<(() => void) | null>(null);
  const autoSwitchedSummaryMeetingIdsRef = useRef(new Set<string>());
  const manuallySelectedTabMeetingIdsRef = useRef(new Set<string>());
  const autoGenerationStartedMeetingIdRef = useRef<string | null>(null);
  const pendingSummaryActionRef = useRef<{ kind: 'generate' | 'regenerate'; prompt: string }>({
    kind: 'generate',
    prompt: '',
  });
  const retrySummaryAfterRefreshRef = useRef(false);

  // Sidebar context
  const { serverAddress } = useSidebar();

  // Get model config from ConfigContext
  const { modelConfig, setModelConfig, isModelConfigLoading } = useConfig();

  // Custom hooks
  const meetingData = useMeetingData({ meeting, summaryData, onMeetingUpdated });
  const templates = useTemplates();

  // Callback to register the modal open function
  const handleRegisterModalOpen = (openFn: () => void) => {
    console.log('📝 Registering modal open function in PageContent');
    openModelSettingsRef.current = openFn;
  };

  // Callback to trigger modal open (called from error handler)
  const handleOpenModelSettings = () => {
    console.log('🔔 Opening model settings from PageContent');
    if (openModelSettingsRef.current) {
      openModelSettingsRef.current();
    } else {
      console.warn('⚠️ Modal open function not yet registered');
    }
  };

  // Save model config to backend database and sync via event
  const handleSaveModelConfig = async (config?: ModelConfig) => {
    if (!config) return;
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey ?? null,
        ollamaEndpoint: config.ollamaEndpoint ?? null,
      });

      // Emit event so ConfigContext and other listeners stay in sync
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

      toast.success('Model settings saved successfully');
    } catch (error) {
      console.error('Failed to save model config:', error);
      toast.error('Failed to save model settings');
    }
  };

  const summaryGeneration = useSummaryGeneration({
    initialSummary,
    meeting,
    transcripts: meetingData.transcripts,
    modelConfig: modelConfig,
    isModelConfigLoading,
    selectedTemplate: templates.selectedTemplate,
    onMeetingUpdated,
    updateMeetingTitle: meetingData.updateMeetingTitle,
    setAiSummary: meetingData.setAiSummary,
    onOpenModelSettings: handleOpenModelSettings,
  });

  const handleSummaryRouteStateChange = useCallback((state: ProviderRouteViewState) => {
    setSummaryRouteState(state);
    if (state.status === 'validated') {
      setSummaryRouteFailure(null);
      setIsSummaryRouteRetrying(false);
    } else if (state.status !== 'loading') {
      setSummaryRouteFailure(state.failure);
      setIsSummaryRouteRetrying(false);
    }
  }, []);

  const executeSummaryAction = useCallback(async (
    kind: 'generate' | 'regenerate',
    prompt: string,
  ): Promise<boolean> => {
    pendingSummaryActionRef.current = { kind, prompt };
    if (summaryRouteState.status !== 'validated') {
      if (summaryRouteState.failure) {
        setSummaryRouteFailure(summaryRouteState.failure);
      }
      return false;
    }

    setIsSummaryRouteRetrying(true);
    try {
      const currentRoute = await validateProviderRoute(summaryRouteState.route);
      if (!isRouteAvailable(currentRoute)) {
        throw currentRoute;
      }
      setSummaryRouteState({ status: 'validated', route: currentRoute, failure: null });
      setSummaryRouteFailure(null);
    } catch (error) {
      setSummaryRouteFailure(normalizeProviderRouteFailure(
        error,
        'summary',
        summaryRouteState.route,
      ));
      return false;
    } finally {
      setIsSummaryRouteRetrying(false);
    }

    if (kind === 'regenerate') {
      await summaryGeneration.handleRegenerateSummary();
    } else {
      await summaryGeneration.handleGenerateSummary(prompt);
    }
    return true;
  }, [summaryGeneration, summaryRouteState]);

  const handleGenerateSummaryWithRoute = useCallback(async (prompt: string) => {
    await executeSummaryAction('generate', prompt);
  }, [executeSummaryAction]);

  const handleRegenerateSummaryWithRoute = useCallback(async () => {
    await executeSummaryAction('regenerate', '');
  }, [executeSummaryAction]);

  const handleRetrySummary = useCallback(() => {
    if (summaryRouteState.status === 'validated') {
      const pending = pendingSummaryActionRef.current;
      void executeSummaryAction(pending.kind, pending.prompt);
      return;
    }
    retrySummaryAfterRefreshRef.current = true;
    setIsSummaryRouteRetrying(true);
    setSummaryRouteRefreshKey((current) => current + 1);
  }, [executeSummaryAction, summaryRouteState.status]);

  useEffect(() => {
    if (!retrySummaryAfterRefreshRef.current || summaryRouteState.status !== 'validated') return;
    retrySummaryAfterRefreshRef.current = false;
    const pending = pendingSummaryActionRef.current;
    void executeSummaryAction(pending.kind, pending.prompt);
  }, [executeSummaryAction, summaryRouteState.status]);

  const copyOperations = useCopyOperations({
    meeting,
    transcripts: meetingData.transcripts,
    meetingTitle: meetingData.meetingTitle,
    aiSummary: meetingData.aiSummary,
    blockNoteSummaryRef: meetingData.blockNoteSummaryRef,
  });

  const meetingOperations = useMeetingOperations({
    meeting,
  });

  // Track page view
  useEffect(() => {
    Analytics.trackPageView('meeting_details');
  }, []);

  useEffect(() => {
    if (
      (meetingData.aiSummary || summaryGeneration.summaryStatus === 'completed')
      && !autoSwitchedSummaryMeetingIdsRef.current.has(meeting.id)
      && !manuallySelectedTabMeetingIdsRef.current.has(meeting.id)
    ) {
      autoSwitchedSummaryMeetingIdsRef.current.add(meeting.id);
      setActiveTab('summary');
    }
  }, [meeting.id, meetingData.aiSummary, summaryGeneration.summaryStatus]);

  // Auto-generate only after the model configuration has settled.
  useEffect(() => {
    if (
      !shouldAutoGenerate
      || summaryGeneration.summaryStatus !== 'idle'
      || isModelConfigLoading
      || meetingData.transcripts.length === 0
      || autoGenerationStartedMeetingIdRef.current === meeting.id
    ) {
      return;
    }

    if (summaryRouteState.status !== 'validated') return;

    autoGenerationStartedMeetingIdRef.current = meeting.id;
    console.log(`🤖 Auto-generating summary with ${modelConfig.provider}/${modelConfig.model}...`);
    void executeSummaryAction('generate', '').then((started) => {
      if (started) {
        onAutoGenerateComplete?.();
      } else {
        autoGenerationStartedMeetingIdRef.current = null;
      }
    });
  }, [
    shouldAutoGenerate,
    meeting.id,
    meetingData.transcripts.length,
    isModelConfigLoading,
    modelConfig.provider,
    modelConfig.model,
    executeSummaryAction,
    summaryGeneration.summaryStatus,
    summaryRouteState.status,
    onAutoGenerateComplete,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-screen min-w-0 flex-col bg-background"
    >
      <header className="shrink-0 border-b bg-card px-6 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="line-clamp-2 min-w-0 flex-1 text-lg font-semibold text-foreground">
            {meetingData.meetingTitle}
          </h1>
          <MeetingCompleteness
            lifecycle={meeting.lifecycle}
            completeness={meeting.completeness}
            gapCount={meeting.gap_count}
            variant="compact"
          />
        </div>
        <MeetingCompleteness
          className="mt-3"
          lifecycle={meeting.lifecycle}
          completeness={meeting.completeness}
          gapCount={meeting.gap_count}
          gaps={meeting.gaps}
          variant="detail"
          showStatus={false}
        />
      </header>
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <MeetingDetailsSplitView
          activeTab={activeTab}
          onTabChange={(tab) => {
            manuallySelectedTabMeetingIdsRef.current.add(meeting.id);
            setActiveTab(tab);
          }}
          transcript={
            <TranscriptPanel
              transcripts={meetingData.transcripts}
              customPrompt={customPrompt}
              onPromptChange={setCustomPrompt}
              onCopyTranscript={copyOperations.handleCopyTranscript}
              onOpenMeetingFolder={meetingOperations.handleOpenMeetingFolder}
              isRecording={isRecording}
              disableAutoScroll={true}
              usePagination={true}
              segments={segments}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              totalCount={totalCount}
              loadedCount={loadedCount}
              onLoadMore={onLoadMore}
              meetingId={meeting.id}
              meetingFolderPath={meeting.folder_path}
              onRefetchTranscripts={onRefetchTranscripts}
            />
          }
          summary={
            <div className="flex h-full min-w-0 flex-1 flex-col">
              <div className="space-y-2 border-b bg-background p-3">
                <ProviderBoundary
                  capability="summary"
                  refreshKey={`${modelConfig.provider}:${modelConfig.model}:${summaryRouteRefreshKey}`}
                  showUnavailableAlert={false}
                  onRouteStateChange={handleSummaryRouteStateChange}
                />
                {summaryRouteFailure && (
                  <ProviderRouteFailureAlert
                    capability="summary"
                    failure={summaryRouteFailure}
                    isRetrying={isSummaryRouteRetrying}
                    onRetry={handleRetrySummary}
                    onChangeProvider={() => {
                      handleOpenModelSettings();
                      window.setTimeout(() => {
                        document.getElementById('summary-provider-control')?.focus();
                      }, 0);
                    }}
                    onCancel={() => {
                      retrySummaryAfterRefreshRef.current = false;
                      setSummaryRouteFailure(null);
                    }}
                  />
                )}
              </div>
              <SummaryPanel
                meeting={meeting}
                meetingTitle={meetingData.meetingTitle}
                summaryRef={meetingData.blockNoteSummaryRef}
                isSaving={meetingData.isSaving}
                isSummaryDirty={meetingData.isSummaryDirty}
                onSaveAll={meetingData.saveAllChanges}
                onCopySummary={copyOperations.handleCopySummary}
                aiSummary={meetingData.aiSummary}
                summaryStatus={summaryGeneration.summaryStatus}
                transcripts={meetingData.transcripts}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                onSaveModelConfig={handleSaveModelConfig}
                onGenerateSummary={handleGenerateSummaryWithRoute}
                onStopGeneration={summaryGeneration.handleStopGeneration}
                customPrompt={customPrompt}
                onSaveSummary={meetingData.handleSaveSummary}
                onSummaryChange={meetingData.handleSummaryChange}
                onDirtyChange={meetingData.setIsSummaryDirty}
                summaryError={summaryGeneration.summaryError}
                onRegenerateSummary={handleRegenerateSummaryWithRoute}
                getSummaryStatusMessage={summaryGeneration.getSummaryStatusMessage}
                availableTemplates={templates.availableTemplates}
                selectedTemplate={templates.selectedTemplate}
                onTemplateSelect={templates.handleTemplateSelection}
                isModelConfigLoading={isModelConfigLoading || isSummaryRouteRetrying || summaryRouteState.status !== 'validated'}
                onOpenModelSettings={handleRegisterModalOpen}
              />
            </div>
          }
        />
      </div>
    </motion.div>
  );
}
