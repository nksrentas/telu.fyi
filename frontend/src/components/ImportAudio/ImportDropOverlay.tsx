import React from 'react';
import { Upload } from 'lucide-react';
import { getAudioFormatsDisplayList } from '@/constants/audioFormats';

interface ImportDropOverlayProps {
  visible: boolean;
}

export function ImportDropOverlay({ visible }: ImportDropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim
                 flex items-center justify-center pointer-events-none
                 transition-opacity duration-200"
    >
      <div className="rounded-[20px] bg-glass-strong p-12 text-center shadow-float
                      outline-dashed outline-2 -outline-offset-[6px]
                      outline-[color:color-mix(in_srgb,var(--accent)_70%,transparent)]
                      backdrop-blur-[30px] backdrop-saturate-[1.8]">
        <Upload className="h-16 w-16 text-accent mx-auto mb-4" />
        <p className="text-body font-semibold text-label">Drop audio file to import</p>
        <p className="text-callout text-label-2 mt-2">{getAudioFormatsDisplayList()}</p>
      </div>
    </div>
  );
}
