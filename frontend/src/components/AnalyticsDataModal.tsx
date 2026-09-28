'use client';

import React from 'react';
import { Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AnalyticsDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDisable: () => void;
}

export default function AnalyticsDataModal({ isOpen, onClose, onConfirmDisable }: AnalyticsDataModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] gap-0 overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 p-[22px] pb-3">
          <Shield className="w-5 h-5 text-label-2" aria-hidden />
          <DialogTitle>What Analytics Collects</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-[22px] py-3 space-y-6">
          {/* Privacy Notice */}
          <div className="rounded-[10px] bg-fill p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-series-green mt-0.5 flex-shrink-0" />
              <div className="text-body text-label">
                <p className="font-semibold mb-1">Your Privacy is Protected</p>
                <p>Analytics is off by default. If you enable it, we collect <strong>anonymous usage data only</strong>. No meeting content, names, file paths, or personal information is ever collected.</p>
              </div>
            </div>
          </div>

          {/* Data Categories */}
          <div className="space-y-4">
            <h3 className="text-title3 text-label">Data We Collect When Enabled:</h3>

            {/* Model Preferences */}
            <div className="rounded-[10px] bg-surface-sunken p-4">
              <h4 className="font-semibold text-label mb-2">1. Model Preferences</h4>
              <ul className="text-body text-label space-y-1 ml-4">
                <li>• Transcription model (e.g., "Whisper large-v3", "Parakeet")</li>
                <li>• Summary model (e.g., "Llama 3.2", "Claude Sonnet")</li>
                <li>• Model provider (e.g., "Local", "Ollama", "OpenRouter")</li>
              </ul>
              <p className="text-xs text-label-2 mt-2 italic">Helps us understand which models users prefer</p>
            </div>

            {/* Meeting Metrics */}
            <div className="rounded-[10px] bg-surface-sunken p-4">
              <h4 className="font-semibold text-label mb-2">2. Anonymous Meeting Metrics</h4>
              <ul className="text-body text-label space-y-1 ml-4">
                <li>• Recording duration (e.g., "125 seconds")</li>
                <li>• Pause duration (e.g., "5 seconds")</li>
                <li>• Number of transcript segments</li>
                <li>• Number of audio chunks processed</li>
              </ul>
              <p className="text-xs text-label-2 mt-2 italic">Helps us optimize performance and understand usage patterns</p>
            </div>

            {/* Device Types */}
            <div className="rounded-[10px] bg-surface-sunken p-4">
              <h4 className="font-semibold text-label mb-2">3. Device Types (Not Names)</h4>
              <ul className="text-body text-label space-y-1 ml-4">
                <li>• Microphone type: "Bluetooth" or "Wired" or "Unknown"</li>
                <li>• System audio type: "Bluetooth" or "Wired" or "Unknown"</li>
              </ul>
              <p className="text-xs text-label-2 mt-2 italic">Helps us improve compatibility, NOT the actual device names</p>
            </div>

            {/* Usage Patterns */}
            <div className="rounded-[10px] bg-surface-sunken p-4">
              <h4 className="font-semibold text-label mb-2">4. App Usage Patterns</h4>
              <ul className="text-body text-label space-y-1 ml-4">
                <li>• App started/stopped events</li>
                <li>• Session duration</li>
                <li>• Feature usage (e.g., "settings changed")</li>
                <li>• Error occurrences (helps us fix bugs)</li>
              </ul>
              <p className="text-xs text-label-2 mt-2 italic">Helps us improve user experience</p>
            </div>

            {/* Platform Info */}
            <div className="rounded-[10px] bg-surface-sunken p-4">
              <h4 className="font-semibold text-label mb-2">5. Platform Information</h4>
              <ul className="text-body text-label space-y-1 ml-4">
                <li>• Operating system (e.g., "macOS", "Windows")</li>
                <li>• App version (automatically included in all events)</li>
                <li>• Architecture (e.g., "x86_64", "aarch64")</li>
              </ul>
              <p className="text-xs text-label-2 mt-2 italic">Helps us prioritize platform support</p>
            </div>
          </div>

          {/* What We DON'T Collect */}
          <div className="rounded-[10px] bg-coral-soft p-4">
            <h4 className="font-semibold text-coral-ink mb-2">What We DON'T Collect:</h4>
            <ul className="text-body text-label space-y-1 ml-4">
              <li>• ❌ Meeting names or titles</li>
              <li>• ❌ File names, file paths, or meeting folders</li>
              <li>• ❌ Meeting transcripts or content</li>
              <li>• ❌ Audio recordings</li>
              <li>• ❌ Device names (only types: Bluetooth/Wired)</li>
              <li>• ❌ Personal information</li>
              <li>• ❌ Any identifiable data</li>
            </ul>
          </div>

          {/* Example Event */}
          <div className="rounded-[10px] bg-surface-sunken p-4">
            <h4 className="font-semibold text-label mb-2">Example Event:</h4>
            <pre className="text-xs text-label overflow-x-auto">
              {`{
  "event": "meeting_ended",
  "app_version": "0.4.1",
  "transcription_provider": "parakeet",
  "transcription_model": "parakeet-tdt-0.6b-v3-int8",
  "summary_provider": "ollama",
  "summary_model": "llama3.2:latest",
  "total_duration_seconds": "125.5",
  "microphone_device_type": "Wired",
  "system_audio_device_type": "Bluetooth",
  "chunks_processed": "150",
  "had_fatal_error": "false"
}`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="justify-between gap-4 p-[22px] pt-4">
          <Button onClick={onClose}>
            Keep Analytics Enabled
          </Button>
          <Button variant="destructive" onClick={onConfirmDisable}>
            Confirm: Disable Analytics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
