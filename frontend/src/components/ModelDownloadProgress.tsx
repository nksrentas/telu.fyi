import React from 'react';
import { ModelStatus } from '../lib/whisper';
import { Button } from './ui/button';
import { Spinner } from '@/components/telu-ui/indicators';

interface ModelDownloadProgressProps {
  status: ModelStatus;
  modelName: string;
  onCancel?: () => void;
}

export function ModelDownloadProgress({ status, modelName, onCancel }: ModelDownloadProgressProps) {
  if (typeof status !== 'object' || !('Downloading' in status)) {
    return null;
  }

  const progress = status.Downloading.progress;
  const isCompleted = progress >= 100;

  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Spinner active={!isCompleted} />
          <span className="text-body font-medium text-label">
            {isCompleted ? 'Finalizing...' : `Downloading ${modelName}`}
          </span>
        </div>
      </div>
      
      <div className="relative">
        <div className="w-full bg-fill-2 rounded-full h-1.5">
          <div 
            className="bg-accent h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-label-2 mt-1">
          <span>{Math.round(progress)}% complete</span>
          {!isCompleted && (
            <span>Downloading...</span>
          )}
        </div>
      </div>
      
      {isCompleted && (
        <div className="mt-2 text-xs text-label-2">
          ✓ Download completed, loading model...
        </div>
      )}
    </div>
  );
}

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({ progress, size = 40, strokeWidth = 3 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-fill-3"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="stroke-accent transition-all duration-300 ease-in-out"
        />
      </svg>
      <span className="absolute text-xs font-medium text-accent">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

interface DownloadSummaryProps {
  totalModels: number;
  downloadedModels: number;
  totalSizeMb: number;
}

export function DownloadSummary({ totalModels, downloadedModels, totalSizeMb }: DownloadSummaryProps) {
  const formatSize = (mb: number) => {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)}GB`;
    return `${mb}MB`;
  };

  return (
    <div className="bg-surface-sunken rounded-lg p-3 text-body">
      <div className="flex items-center justify-between">
        <span className="text-label">
          📦 {downloadedModels} of {totalModels} models available
        </span>
        <span className="text-label-2">
          💾 {formatSize(totalSizeMb)} total
        </span>
      </div>
      {downloadedModels > 0 && (
        <div className="mt-1 text-xs text-label-2">
          ✓ Models run locally - no internet required for transcription
        </div>
      )}
    </div>
  );
}
