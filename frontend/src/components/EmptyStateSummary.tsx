'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/telu-ui/empty-state';
import { DURATION, EASE } from '@/lib/motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmptyStateSummaryProps {
  onGenerate: () => void;
  hasModel: boolean;
  isGenerating?: boolean;
  error?: string | null;
}

export function EmptyStateSummary({
  onGenerate,
  hasModel,
  isGenerating = false,
  error = null,
}: EmptyStateSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(2px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: DURATION.viewFade, ease: EASE.out }}
      className="flex h-full flex-col items-center justify-center"
    >
      <EmptyState
        compact
        title="No Summary Generated Yet"
        body="Generate an AI-powered summary of your meeting transcript to get key points, action items, and decisions."
        footnote={hasModel ? undefined : 'Please select a model in Settings first'}
        actions={
          <div className="flex flex-col items-center gap-4">
            {error && (
              <p role="alert" className="max-w-md rounded-lg bg-coral-soft px-3 py-2 text-body text-coral-ink">
                {error}
              </p>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="primary"
                      onClick={onGenerate}
                      disabled={!hasModel || isGenerating}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isGenerating ? 'Generating...' : error ? 'Retry summary' : 'Generate Summary'}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!hasModel && (
                  <TooltipContent>
                    <p>Please select a model in Settings first</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      />
    </motion.div>
  );
}
