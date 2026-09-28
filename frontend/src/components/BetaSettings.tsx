"use client"

import { Switch } from "./ui/switch"
import { FlaskConical, AlertCircle } from "lucide-react"
import { useConfig } from "@/contexts/ConfigContext"
import {
  BetaFeatureKey,
  BETA_FEATURE_NAMES,
  BETA_FEATURE_DESCRIPTIONS
} from "@/types/betaFeatures"

export function BetaSettings() {
  const { betaFeatures, toggleBetaFeature } = useConfig();

  // Define feature order for display (allows custom ordering)
  const featureOrder: BetaFeatureKey[] = ['importAndRetranscribe'];

  return (
    <div className="space-y-6">
      {/* Yellow Warning Banner */}
      <div className="flex items-start gap-3 rounded-[10px] bg-amber-soft p-4">
        <AlertCircle className="h-5 w-5 text-amber flex-shrink-0 mt-0.5" />
        <div className="text-body text-label">
          <p className="font-medium">Beta Features</p>
          <p className="mt-1">
            These features are still being tested. You may encounter issues, and we appreciate your feedback.
          </p>
        </div>
      </div>

      {/* Dynamic Feature Toggles - Automatically renders all features */}
      {featureOrder.map((featureKey) => (
        <div
          key={featureKey}
          className="rounded-card bg-surface p-6 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-5 w-5 text-label-2" />
                <h3 className="text-title3 text-label">
                  {BETA_FEATURE_NAMES[featureKey]}
                </h3>
                <span className="inline-flex h-5 items-center rounded-full bg-amber-soft px-2 text-[11px] font-medium text-amber">
                  BETA
                </span>
              </div>
              <p className="text-callout text-label-2">
                {BETA_FEATURE_DESCRIPTIONS[featureKey]}
              </p>
            </div>

            <div className="ml-6">
              <Switch
                checked={betaFeatures[featureKey]}
                onCheckedChange={(checked) => toggleBetaFeature(featureKey, checked)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Info Box */}
      <div className="rounded-[10px] bg-fill p-4">
        <p className="text-body text-label-2">
          <strong>Note:</strong> When disabled, beta features will be hidden. Your existing meetings remain unaffected.
        </p>
      </div>
    </div>
  );
}
