//! Typed, run-correlated resource and power observations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const RESOURCE_SCHEMA_VERSION: u16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceScope {
    Process,
    System,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CpuMemoryObservation {
    pub scope: ResourceScope,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub total_memory_bytes: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PowerSource {
    Ac,
    Battery,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnknownReason {
    CollectorUnavailable,
    BatteryNotReported,
    UnparseableObservation,
    EnergyImpactNotMeasured,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Observation<T> {
    Observed { value: T },
    Unknown { reason: UnknownReason },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PowerObservation {
    pub collector: String,
    pub method: String,
    pub source: Observation<PowerSource>,
    pub battery_percent: Observation<f32>,
    pub energy_impact: Observation<f32>,
    pub uncertainty: Option<String>,
}

impl PowerObservation {
    pub fn unknown(
        collector: impl Into<String>,
        method: impl Into<String>,
        reason: UnknownReason,
    ) -> Self {
        Self {
            collector: collector.into(),
            method: method.into(),
            source: Observation::Unknown { reason },
            battery_percent: Observation::Unknown { reason },
            energy_impact: Observation::Unknown {
                reason: UnknownReason::EnergyImpactNotMeasured,
            },
            uncertainty: Some("power_or_battery_observation_unavailable".to_string()),
        }
    }

    pub fn has_defensible_battery_observation(&self) -> bool {
        matches!(self.battery_percent, Observation::Observed { .. }) && self.uncertainty.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResourceSample {
    pub schema_version: u16,
    pub run_id: String,
    pub sequence: u64,
    pub interval_ms: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub process: CpuMemoryObservation,
    pub system: CpuMemoryObservation,
    pub power: PowerObservation,
}

#[allow(clippy::too_many_arguments)]
fn build_resource_sample(
    run_id: &str,
    sequence: u64,
    interval_ms: u64,
    observed_offset_micros: u64,
    observed_at_utc: DateTime<Utc>,
    process_cpu_percent: f32,
    process_memory_bytes: u64,
    system_cpu_percent: f32,
    system_memory_bytes: u64,
    system_total_memory_bytes: u64,
    power: PowerObservation,
) -> ResourceSample {
    ResourceSample {
        schema_version: RESOURCE_SCHEMA_VERSION,
        run_id: run_id.to_string(),
        sequence,
        // Intentional RED: the implementation must retain the real interval.
        interval_ms: 0,
        observed_offset_micros,
        observed_at_utc,
        process: CpuMemoryObservation {
            // Intentional RED: process and system scopes must remain distinct.
            scope: ResourceScope::System,
            cpu_percent: process_cpu_percent,
            memory_bytes: process_memory_bytes,
            total_memory_bytes: None,
        },
        system: CpuMemoryObservation {
            scope: ResourceScope::System,
            cpu_percent: system_cpu_percent,
            memory_bytes: system_memory_bytes,
            total_memory_bytes: Some(system_total_memory_bytes),
        },
        power,
    }
}

#[cfg(target_os = "macos")]
fn parse_macos_pmset(_output: &str) -> PowerObservation {
    PowerObservation::unknown(
        "macos_pmset",
        "pmset_g_batt",
        UnknownReason::UnparseableObservation,
    )
}

#[cfg(test)]
mod resource_sampler_tests {
    use super::*;

    #[test]
    fn resource_sampler_records_interval_scope_process_and_system_metrics() {
        let sample = build_resource_sample(
            "run-1",
            4,
            250,
            1_500_000,
            Utc::now(),
            12.5,
            64 * 1024 * 1024,
            48.0,
            8 * 1024 * 1024 * 1024,
            16 * 1024 * 1024 * 1024,
            PowerObservation::unknown(
                "test_collector",
                "synthetic",
                UnknownReason::CollectorUnavailable,
            ),
        );

        assert_eq!(sample.run_id, "run-1");
        assert_eq!(sample.sequence, 4);
        assert_eq!(sample.interval_ms, 250);
        assert_eq!(sample.observed_offset_micros, 1_500_000);
        assert_eq!(sample.process.scope, ResourceScope::Process);
        assert_eq!(sample.process.cpu_percent, 12.5);
        assert_eq!(sample.process.memory_bytes, 64 * 1024 * 1024);
        assert_eq!(sample.process.total_memory_bytes, None);
        assert_eq!(sample.system.scope, ResourceScope::System);
        assert_eq!(sample.system.cpu_percent, 48.0);
        assert_eq!(sample.system.memory_bytes, 8 * 1024 * 1024 * 1024);
        assert_eq!(
            sample.system.total_memory_bytes,
            Some(16 * 1024 * 1024 * 1024)
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn resource_sampler_parses_power_source_and_battery_with_method() {
        let power = parse_macos_pmset(
            "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t87%; charging; 0:42 remaining present: true",
        );

        assert_eq!(power.collector, "macos_pmset");
        assert_eq!(power.method, "pmset_g_batt");
        assert_eq!(
            power.source,
            Observation::Observed {
                value: PowerSource::Ac
            }
        );
        assert_eq!(power.battery_percent, Observation::Observed { value: 87.0 });
        assert_eq!(
            power.energy_impact,
            Observation::Unknown {
                reason: UnknownReason::EnergyImpactNotMeasured
            }
        );
        assert!(power.uncertainty.is_none());
        assert!(power.has_defensible_battery_observation());
    }

    #[test]
    fn resource_sampler_unknown_power_is_blocking_and_never_cpu_derived() {
        let power = PowerObservation::unknown(
            "unsupported_platform",
            "no_approved_collector",
            UnknownReason::CollectorUnavailable,
        );

        assert!(!power.has_defensible_battery_observation());
        assert_eq!(
            power.battery_percent,
            Observation::Unknown {
                reason: UnknownReason::CollectorUnavailable
            }
        );
        assert_eq!(
            power.energy_impact,
            Observation::Unknown {
                reason: UnknownReason::EnergyImpactNotMeasured
            }
        );
        assert_eq!(
            power.uncertainty.as_deref(),
            Some("power_or_battery_observation_unavailable")
        );
    }
}
