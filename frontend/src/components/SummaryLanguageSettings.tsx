'use client';

import { useState } from 'react';
import { Globe, Pin } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { LanguagePickerPopover } from '@/components/LanguagePickerPopover';
import { useRecentLanguages } from '@/hooks/useRecentLanguages';
import { labelForCode } from '@/lib/summary-languages';

export function SummaryLanguageSettings() {
  const { recents, pinned, addRecent, removeRecent, setPinned } = useRecentLanguages();
  const [pickerOpen, setPickerOpen] = useState(false);

  const togglePin = (code: string) => {
    setPinned(pinned === code ? null : code);
  };

  return (
    <div className="rounded-card bg-surface p-6 shadow-card relative">
      <div className="flex items-center gap-2 mb-2">
        <Globe size={18} className="text-label-2" />
        <h3 className="text-title3 text-label">Summary Language</h3>
      </div>
      <p className="text-callout text-label-2 mb-4">
        Pin one language as the default for new meetings. Unpinned languages remain as
        quick-switch options in the summary generator. Auto uses the dominant transcript language.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {recents.map((code) => {
          const isPinned = pinned === code;
          return (
            <span
              key={code}
              className={`inline-flex h-7 items-center overflow-hidden rounded-full text-body ${
                isPinned ? 'bg-accent-soft text-accent-strong' : 'bg-fill-2 text-label'
              }`}
            >
              <button
                type="button"
                aria-label={isPinned ? `Unpin ${labelForCode(code)} as default` : `Pin ${labelForCode(code)} as default`}
                aria-pressed={isPinned}
                title={isPinned ? 'Click to unset as default' : 'Click to set as default'}
                onClick={() => togglePin(code)}
                className={`flex h-full items-center gap-1.5 pl-3 pr-2 hover:brightness-95 active:brightness-90 ${
                  isPinned ? 'text-accent-strong' : 'text-label'
                }`}
              >
                <Pin
                  size={14}
                  className={isPinned ? 'text-accent' : 'text-label-3'}
                  fill={isPinned ? 'currentColor' : 'none'}
                />
                {labelForCode(code)}
              </button>
              <button
                type="button"
                aria-label={`Remove ${labelForCode(code)}`}
                onClick={() => removeRecent(code)}
                className={`h-full pr-2.5 pl-0.5 leading-none ${isPinned ? 'text-accent hover:text-accent-strong' : 'text-label-3 hover:text-label'}`}
              >
                ×
              </button>
            </span>
          );
        })}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={recents.length >= 5}
              className="inline-flex h-7 items-center gap-1 rounded-full px-3 text-callout text-label-2 outline-dashed outline-1 -outline-offset-1 outline-label-4 hover:text-label disabled:cursor-not-allowed disabled:opacity-[0.45]"
            >
              ＋ Add language
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 border-0 shadow-none bg-transparent">
            <LanguagePickerPopover
              mode="settings"
              value={null}
              onChange={(code) => {
                if (code) addRecent(code);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-label-3 mt-3">
        {pinned
          ? `Default: ${labelForCode(pinned)} - click it again to unset. Max 5 quick-switch options.`
          : 'Click any language to set it as your default. Max 5 quick-switch options.'}
      </p>
    </div>
  );
}
