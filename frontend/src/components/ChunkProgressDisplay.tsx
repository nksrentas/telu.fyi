import React from 'react';
import { Spinner } from '@/components/telu-ui/indicators';
import { Button } from '@/components/ui/button';

export interface ChunkStatus {
  chunk_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  start_time?: number;
  end_time?: number;
  duration_ms?: number;
  text_preview?: string;
  error_message?: string;
}

export interface ProcessingProgress {
  total_chunks: number;
  completed_chunks: number;
  processing_chunks: number;
  failed_chunks: number;
  estimated_remaining_ms?: number;
  chunks: ChunkStatus[];
}

interface ChunkProgressDisplayProps {
  progress: ProcessingProgress;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  isPaused?: boolean;
  className?: string;
}

export function ChunkProgressDisplay({
  progress,
  onPause,
  onResume,
  onCancel,
  isPaused = false,
  className = ''
}: ChunkProgressDisplayProps) {
  const completionPercentage = progress.total_chunks > 0
    ? Math.round((progress.completed_chunks / progress.total_chunks) * 100)
    : 0;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimeRemaining = (ms?: number) => {
    if (!ms || ms <= 0) return 'Calculating...';
    return formatDuration(ms);
  };

  const getChunkStatusIcon = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⚡';
      case 'failed':
        return '❌';
      case 'pending':
      default:
        return '⏳';
    }
  };

  const getChunkStatusColor = (status: ChunkStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'text-label bg-fill';
      case 'processing':
        return 'text-label bg-fill-2';
      case 'failed':
        return 'text-coral-ink bg-coral-soft';
      case 'pending':
      default:
        return 'text-label-2 bg-surface-sunken';
    }
  };

  return (
    <div className={`rounded-card bg-surface p-4 shadow-card ${className}`}>
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-title3 text-label">
            Processing Progress
          </h3>
          {isPaused && (
            <span className="bg-amber-soft text-amber px-2 py-1 rounded-full text-xs font-medium">
              Paused
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {!isPaused ? (
            <Button
              size="sm"
              onClick={onPause}
              disabled={progress.processing_chunks === 0 && progress.completed_chunks === progress.total_chunks}
            >
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onResume}
            >
              Resume
            </Button>
          )}

          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-body font-medium text-label">
            {progress.completed_chunks} of {progress.total_chunks} chunks completed
          </span>
          <span className="text-body font-medium text-label">
            {completionPercentage}%
          </span>
        </div>

        <div className="w-full bg-fill-2 rounded-full h-1.5">
          <div
            className="bg-accent h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Processing Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4 text-body">
        <div className="text-center">
          <div className="text-title3 text-series-green">
            {progress.completed_chunks}
          </div>
          <div className="text-label-2">Completed</div>
        </div>

        <div className="text-center">
          <div className="text-title3 text-label">
            {progress.processing_chunks}
          </div>
          <div className="text-label-2">Processing</div>
        </div>

        <div className="text-center">
          <div className="text-title3 text-label-2">
            {progress.total_chunks - progress.completed_chunks - progress.processing_chunks - progress.failed_chunks}
          </div>
          <div className="text-label-2">Pending</div>
        </div>

        <div className="text-center">
          <div className="text-title3 text-coral-ink">
            {progress.failed_chunks}
          </div>
          <div className="text-label-2">Failed</div>
        </div>
      </div>

      {/* Time Estimate */}
      {progress.estimated_remaining_ms && progress.estimated_remaining_ms > 0 && (
        <div className="rounded-lg bg-fill p-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-label-2">⏱️</span>
            <span className="text-body text-label-2">
              Estimated time remaining: {formatTimeRemaining(progress.estimated_remaining_ms)}
            </span>
          </div>
        </div>
      )}

      {/* Recent Chunks Grid */}
      <div className="space-y-2">
        <h4 className="text-body font-medium text-label mb-2">
          Recent Chunks ({Math.min(progress.chunks.length, 10)} of {progress.total_chunks})
        </h4>

        <div className="max-h-48 overflow-y-auto space-y-1">
          {progress.chunks
            .slice(-10) // Show last 10 chunks
            .reverse() // Most recent first
            .map((chunk) => (
              <div
                key={chunk.chunk_id}
                className={`text-xs p-2 rounded-md ${getChunkStatusColor(chunk.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>{getChunkStatusIcon(chunk.status)}</span>
                    <span className="font-medium">
                      Chunk {chunk.chunk_id}
                    </span>
                    {chunk.duration_ms && (
                      <span className="text-label-2">
                        ({formatDuration(chunk.duration_ms)})
                      </span>
                    )}
                  </div>

                  {chunk.status === 'processing' && (
                    <div className="flex items-center space-x-1">
                      <Spinner active size={10} />
                    </div>
                  )}
                </div>

                {chunk.text_preview && (
                  <div className="mt-1 text-label text-xs truncate">
                    "{chunk.text_preview}"
                  </div>
                )}

                {chunk.error_message && (
                  <div className="mt-1 text-coral-ink text-xs">
                    Error: {chunk.error_message}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Processing Complete */}
      {progress.completed_chunks === progress.total_chunks && progress.total_chunks > 0 && (
        <div className="mt-4 rounded-lg bg-fill p-3">
          <div className="flex items-center space-x-2">
            <span className="text-series-green">🎉</span>
            <span className="text-body font-medium text-label">
              Processing completed! All {progress.total_chunks} chunks have been transcribed.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Mini version for sidebar or compact display
export function ChunkProgressMini({ progress, className = '' }: { progress: ProcessingProgress; className?: string }) {
  const completionPercentage = progress.total_chunks > 0
    ? Math.round((progress.completed_chunks / progress.total_chunks) * 100)
    : 0;

  return (
    <div className={`rounded-[10px] bg-surface-sunken p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-body font-medium text-label">
          Processing
        </span>
        <span className="text-body font-medium text-label">
          {completionPercentage}%
        </span>
      </div>

      <div className="w-full bg-fill-2 rounded-full h-1.5 mb-2">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      <div className="text-xs text-label-2">
        {progress.completed_chunks} / {progress.total_chunks} chunks
        {progress.processing_chunks > 0 && (
          <span className="ml-2 text-label-2">
            ({progress.processing_chunks} processing)
          </span>
        )}
      </div>
    </div>
  );
}