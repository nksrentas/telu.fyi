import { ModelConfig } from "@/components/ModelSettingsModal";
import { PreferenceSettings } from "@/components/PreferenceSettings";
import { DeviceSelection } from "@/components/DeviceSelection";
import { LanguageSelection } from "@/components/LanguageSelection";
import { TranscriptSettings } from "@/components/TranscriptSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useConfig } from "@/contexts/ConfigContext";
import { useRecordingState } from "@/contexts/RecordingStateContext";
import { ProviderBoundary } from "@/components/ProviderBoundary";
import { DiagnosticsPanel } from "@/components/DiagnosticsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type modalType = "modelSettings" | "deviceSettings" | "languageSettings" | "modelSelector" | "errorAlert" | "chunkDropWarning";

/**
 * SettingsModals Component
 *
 * All settings modals consolidated into a single component.
 * Uses ConfigContext and RecordingStateContext internally - no prop drilling needed!
 */

interface SettingsModalsProps {
  modals: {
    modelSettings: boolean;
    deviceSettings: boolean;
    languageSettings: boolean;
    modelSelector: boolean;
    errorAlert: boolean;
    chunkDropWarning: boolean;
  };
  messages: {
    errorAlert: string;
    chunkDropWarning: string;
    modelSelector: string;
  };
  onClose: (name: modalType) => void;
}

export function SettingsModals({
  modals,
  messages,
  onClose,
}: SettingsModalsProps) {
  // Contexts
  const {
    modelConfig,
    setModelConfig,
    models,
    modelOptions,
    error,
    selectedDevices,
    setSelectedDevices,
    selectedLanguage,
    setSelectedLanguage,
    transcriptModelConfig,
    setTranscriptModelConfig,
    showConfidenceIndicator,
    toggleConfidenceIndicator,
  } = useConfig();

  const { isRecording } = useRecordingState();

  return <>
    {/* Legacy Settings Modal */}
    {modals.modelSettings && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50 p-4">
        <div className="rounded-[20px] bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-title2 text-label">Preferences</h3>
            <button
              onClick={() => onClose("modelSettings")
              }
              className="text-label-2 hover:text-label"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="preferences" className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="preferences">General</TabsTrigger>
                <TabsTrigger value="models">AI model</TabsTrigger>
                <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
              </TabsList>

              <TabsContent value="preferences" className="pt-6">
                <PreferenceSettings />
              </TabsContent>

              <TabsContent value="models" className="pt-6">
                <div>
                  <h4 className="mb-4 text-title3 text-label">AI Model Configuration</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-body font-medium text-label">
                        Summarization Model
                      </label>
                      <div className="flex space-x-2">
                        <select
                          className="h-7 rounded-[7px] bg-content px-2.5 text-body shadow-[inset_0_0_0_0.5px_var(--hairline),0_0.5px_1px_rgba(23,25,31,0.04)] outline-none focus:shadow-[inset_0_0_0_0.5px_var(--accent),0_0_0_3.5px_color-mix(in_srgb,var(--accent)_32%,transparent)]"
                          value={modelConfig.provider}
                          onChange={(e) => {
                            const provider = e.target.value as ModelConfig['provider'];
                            setModelConfig({
                              ...modelConfig,
                              provider,
                              model: modelOptions[provider][0]
                            });
                          }}
                        >
                          <option value="builtin-ai">Built-in AI</option>
                          <option value="claude">Claude</option>
                          <option value="groq">Groq</option>
                          <option value="ollama">Ollama</option>
                          <option value="openrouter">OpenRouter</option>
                          <option value="openai">OpenAI</option>
                        </select>

                        <select
                          className="flex-1 h-7 rounded-[7px] bg-content px-2.5 text-body shadow-[inset_0_0_0_0.5px_var(--hairline),0_0.5px_1px_rgba(23,25,31,0.04)] outline-none focus:shadow-[inset_0_0_0_0.5px_var(--accent),0_0_0_3.5px_color-mix(in_srgb,var(--accent)_32%,transparent)]"
                          value={modelConfig.model}
                          onChange={(e) => setModelConfig((prev: ModelConfig) => ({ ...prev, model: e.target.value }))}
                        >
                          {modelOptions[modelConfig.provider].map((model: string) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                      <ProviderBoundary
                        capability="summary"
                        refreshKey={`${modelConfig.provider}:${modelConfig.model}:${modelConfig.ollamaEndpoint ?? ''}`}
                        className="mt-4"
                      />
                    </div>
                    {modelConfig.provider === 'ollama' && (
                      <div>
                        <h4 className="mb-4 text-title3">Available Ollama Models</h4>
                        {error && <div className="mb-4 rounded-lg bg-coral-soft px-4 py-3 text-coral-ink">{error}</div>}
                        <div className="max-h-[400px] space-y-4 overflow-y-auto pr-2">
                          {models.map((model) => (
                            <button
                              type="button"
                              key={model.id}
                              className={`block w-full rounded-card bg-surface p-4 text-left shadow-card transition-shadow ${modelConfig.model === model.name ? 'ring-2 ring-accent' : 'hover:shadow-card-hover'}`}
                              onClick={() => setModelConfig((prev: ModelConfig) => ({ ...prev, model: model.name }))}
                            >
                              <span className="block font-bold">{model.name}</span>
                              <span className="block text-label-2">Size: {model.size}</span>
                              <span className="block text-label-2">Modified: {model.modified}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="diagnostics" className="mt-0">
                <DiagnosticsPanel />
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="border-t p-6 flex justify-end">
            <Button
              variant="primary"
              onClick={() => onClose('modelSettings')}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Device Settings Modal */}
    {modals.deviceSettings && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50">
        <div className="rounded-[20px] bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] p-[22px] max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-title3 text-label">Audio Device Settings</h3>
            <button
              onClick={() => onClose('deviceSettings')}
              className="text-label-2 hover:text-label"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <DeviceSelection
            selectedDevices={selectedDevices}
            onDeviceChange={setSelectedDevices}
            disabled={isRecording}
          />

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                const micDevice = selectedDevices.micDevice || 'Default';
                const systemDevice = selectedDevices.systemDevice || 'Default';
                toast.success("Devices selected", {
                  description: `Microphone: ${micDevice}, System Audio: ${systemDevice}`
                });
                onClose('deviceSettings');
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Language Settings Modal */}
    {modals.languageSettings && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50">
        <div className="rounded-[20px] bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] p-[22px] max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-title3 text-label">Language Settings</h3>
            <button
              onClick={() => onClose('languageSettings')}
              className="text-label-2 hover:text-label"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <LanguageSelection
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            disabled={isRecording}
            provider={transcriptModelConfig.provider}
          />

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={() => onClose('languageSettings')}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Model Selection Modal */}
    {modals.modelSelector && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50">
        <div className="rounded-[20px] bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8] max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex justify-between items-center p-6 pb-4 border-b border-separator">
            <h3 className="text-title3 text-label">
              {messages.modelSelector ? 'Speech Recognition Setup Required' : 'Transcription Model Settings'}
            </h3>
            <button
              onClick={() => onClose('modelSelector')}
              className="text-label-2 hover:text-label"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            <TranscriptSettings
              transcriptModelConfig={transcriptModelConfig}
              setTranscriptModelConfig={setTranscriptModelConfig}
              onModelSelect={() => onClose('modelSelector')}
            />
          </div>

          {/* Fixed Footer */}
          <div className="p-6 pt-4 border-t border-separator flex items-center justify-between">
            {/* Confidence Indicator Toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showConfidenceIndicator}
                  onChange={(e) => toggleConfidenceIndicator(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative h-[18px] w-8 rounded-full bg-fill-3 transition-colors duration-200 peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] after:absolute after:left-0.5 after:top-0.5 after:size-3.5 after:rounded-full after:bg-accent-foreground after:shadow-[0_1px_2px_rgba(0,0,0,0.22)] after:transition-transform after:duration-spring-bounce after:ease-spring-bounce after:content-[''] peer-checked:after:translate-x-3.5"></div>
              </label>
              <div>
                <p className="text-body font-medium text-label">Show Confidence Indicators</p>
                <p className="text-xs text-label-2">Display colored dots showing transcription confidence quality</p>
              </div>
            </div>

            <Button
              onClick={() => onClose('modelSelector')}
            >
              {messages.modelSelector ? 'Cancel' : 'Done'}
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Error Alert Modal */}
    {modals.errorAlert && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50">
        <Alert className="max-w-md mx-4 bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8]">
          <AlertTitle className="text-coral-ink">Recording Stopped</AlertTitle>
          <AlertDescription className="text-coral-ink">
            {messages.errorAlert}
            <button
              onClick={() => onClose('errorAlert')}
              className="ml-2 text-coral-ink underline"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      </div>
    )}

    {/* Chunk Drop Warning Modal */}
    {modals.chunkDropWarning && (
      <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50">
        <Alert className="max-w-lg mx-4 bg-glass-strong shadow-window backdrop-blur-[34px] backdrop-saturate-[1.8]">
          <AlertTitle className="text-label">Transcription Performance Warning</AlertTitle>
          <AlertDescription className="text-label">
            {messages.chunkDropWarning}
            <button
              onClick={() => onClose('chunkDropWarning')}
              className="ml-2 text-label underline"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      </div>
    )}
  </>
}
