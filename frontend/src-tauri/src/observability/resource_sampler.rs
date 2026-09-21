//! Typed, run-correlated resource and power observations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use std::process::Command;
use std::sync::Arc;
use std::time::Instant;
use sysinfo::{get_current_pid, ProcessesToUpdate, System};

use super::StageClock;

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
        matches!(self.source, Observation::Observed { .. })
            && matches!(self.battery_percent, Observation::Observed { .. })
            && self.uncertainty.is_none()
    }

    pub fn has_measured_energy_impact(&self) -> bool {
        matches!(self.energy_impact, Observation::Observed { .. })
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
        interval_ms,
        observed_offset_micros,
        observed_at_utc,
        process: CpuMemoryObservation {
            scope: ResourceScope::Process,
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

pub trait PowerCollector: Send + Sync {
    fn collect(&self) -> PowerObservation;
}

#[derive(Debug, Default)]
pub struct PlatformPowerCollector;

impl PowerCollector for PlatformPowerCollector {
    fn collect(&self) -> PowerObservation {
        collect_platform_power()
    }
}

pub struct ResourceSampler<C = PlatformPowerCollector> {
    stage_clock: Arc<StageClock>,
    system: System,
    process_id: sysinfo::Pid,
    power_collector: C,
    last_sample_at: Instant,
    next_sequence: u64,
}

impl ResourceSampler<PlatformPowerCollector> {
    pub fn new(stage_clock: Arc<StageClock>) -> Result<Self, String> {
        Self::with_collector(stage_clock, PlatformPowerCollector)
    }
}

impl<C: PowerCollector> ResourceSampler<C> {
    pub fn with_collector(
        stage_clock: Arc<StageClock>,
        power_collector: C,
    ) -> Result<Self, String> {
        let process_id = get_current_pid().map_err(|_| "RESOURCE_PROCESS_ID_UNAVAILABLE")?;
        let mut system = System::new_all();
        system.refresh_cpu_usage();
        system.refresh_memory();
        system.refresh_processes(ProcessesToUpdate::Some(&[process_id]), true);

        Ok(Self {
            stage_clock,
            system,
            process_id,
            power_collector,
            last_sample_at: Instant::now(),
            next_sequence: 0,
        })
    }

    /// Collect one local sample. This performs process/system refreshes and a
    /// platform power probe, so callers must keep it off audio callbacks.
    pub fn sample(&mut self) -> Result<ResourceSample, String> {
        self.sample_at(Instant::now(), Utc::now())
    }

    fn sample_at(
        &mut self,
        observed_at: Instant,
        observed_at_utc: DateTime<Utc>,
    ) -> Result<ResourceSample, String> {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.system
            .refresh_processes(ProcessesToUpdate::Some(&[self.process_id]), true);

        let process = self
            .system
            .process(self.process_id)
            .ok_or_else(|| "RESOURCE_PROCESS_UNAVAILABLE".to_string())?;
        let interval_ms = observed_at
            .saturating_duration_since(self.last_sample_at)
            .as_millis()
            .min(u64::MAX as u128) as u64;
        let sequence = self.next_sequence;
        self.next_sequence = self.next_sequence.saturating_add(1);
        self.last_sample_at = observed_at;

        Ok(build_resource_sample(
            self.stage_clock.run_id(),
            sequence,
            interval_ms,
            self.stage_clock.offset_micros_at(observed_at),
            observed_at_utc,
            process.cpu_usage(),
            process.memory(),
            self.system.global_cpu_usage(),
            self.system.used_memory(),
            self.system.total_memory(),
            self.power_collector.collect(),
        ))
    }
}

#[cfg(target_os = "macos")]
fn collect_platform_power() -> PowerObservation {
    match Command::new("/usr/bin/pmset").args(["-g", "batt"]).output() {
        Ok(output) if output.status.success() => match String::from_utf8(output.stdout) {
            Ok(stdout) => parse_macos_pmset(&stdout),
            Err(_) => PowerObservation::unknown(
                "macos_pmset",
                "pmset_g_batt",
                UnknownReason::UnparseableObservation,
            ),
        },
        _ => PowerObservation::unknown(
            "macos_pmset",
            "pmset_g_batt",
            UnknownReason::CollectorUnavailable,
        ),
    }
}

#[cfg(target_os = "linux")]
fn collect_platform_power() -> PowerObservation {
    collect_linux_power_supply()
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn collect_platform_power() -> PowerObservation {
    PowerObservation::unknown(
        "unsupported_platform",
        "no_approved_platform_collector",
        UnknownReason::CollectorUnavailable,
    )
}

#[cfg(target_os = "macos")]
fn parse_macos_pmset(output: &str) -> PowerObservation {
    let source = if output.contains("'AC Power'") {
        Observation::Observed {
            value: PowerSource::Ac,
        }
    } else if output.contains("'Battery Power'") {
        Observation::Observed {
            value: PowerSource::Battery,
        }
    } else {
        Observation::Unknown {
            reason: UnknownReason::UnparseableObservation,
        }
    };
    let battery_percent = output
        .split(|character: char| character.is_whitespace() || character == ';')
        .find_map(|part| {
            part.strip_suffix('%')
                .and_then(|value| value.parse::<f32>().ok())
        })
        .map_or(
            Observation::Unknown {
                reason: UnknownReason::BatteryNotReported,
            },
            |value| Observation::Observed { value },
        );
    let uncertainty = if matches!(source, Observation::Observed { .. })
        && matches!(battery_percent, Observation::Observed { .. })
    {
        None
    } else {
        Some("power_source_or_battery_not_reported".to_string())
    };

    PowerObservation {
        collector: "macos_pmset".to_string(),
        method: "pmset_g_batt".to_string(),
        source,
        battery_percent,
        energy_impact: Observation::Unknown {
            reason: UnknownReason::EnergyImpactNotMeasured,
        },
        uncertainty,
    }
}

#[cfg(target_os = "linux")]
fn collect_linux_power_supply() -> PowerObservation {
    use std::fs;

    let entries = match fs::read_dir("/sys/class/power_supply") {
        Ok(entries) => entries,
        Err(_) => {
            return PowerObservation::unknown(
                "linux_power_supply",
                "sysfs_power_supply",
                UnknownReason::CollectorUnavailable,
            )
        }
    };
    let mut source = None;
    let mut battery_percent = None;
    for entry in entries.flatten().take(32) {
        let path = entry.path();
        let supply_type = fs::read_to_string(path.join("type")).unwrap_or_default();
        if supply_type.trim() == "Battery" {
            battery_percent = fs::read_to_string(path.join("capacity"))
                .ok()
                .and_then(|value| value.trim().parse::<f32>().ok());
            let status = fs::read_to_string(path.join("status")).unwrap_or_default();
            if status.trim() == "Discharging" {
                source = Some(PowerSource::Battery);
            }
        } else if matches!(supply_type.trim(), "Mains" | "USB" | "USB_C") {
            let online = fs::read_to_string(path.join("online")).unwrap_or_default();
            if online.trim() == "1" {
                source = Some(PowerSource::Ac);
            }
        }
    }

    let source = source.map_or(
        Observation::Unknown {
            reason: UnknownReason::UnparseableObservation,
        },
        |value| Observation::Observed { value },
    );
    let battery_percent = battery_percent.map_or(
        Observation::Unknown {
            reason: UnknownReason::BatteryNotReported,
        },
        |value| Observation::Observed { value },
    );
    let uncertainty = if matches!(source, Observation::Observed { .. })
        && matches!(battery_percent, Observation::Observed { .. })
    {
        None
    } else {
        Some("power_source_or_battery_not_reported".to_string())
    };

    PowerObservation {
        collector: "linux_power_supply".to_string(),
        method: "sysfs_power_supply".to_string(),
        source,
        battery_percent,
        energy_impact: Observation::Unknown {
            reason: UnknownReason::EnergyImpactNotMeasured,
        },
        uncertainty,
    }
}

#[cfg(test)]
mod resource_sampler_tests {
    use super::*;
    use std::time::Duration;

    struct FixedPowerCollector;

    impl PowerCollector for FixedPowerCollector {
        fn collect(&self) -> PowerObservation {
            PowerObservation::unknown(
                "fixed_test_collector",
                "synthetic",
                UnknownReason::CollectorUnavailable,
            )
        }
    }

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
        assert!(!power.has_measured_energy_impact());
    }

    #[test]
    fn resource_sampler_uses_the_stage_clock_run_and_monotonic_offset() {
        let origin = Instant::now();
        let clock = StageClock::new_at("run-shared", "meeting-1", 4, origin, Utc::now());
        let mut sampler =
            ResourceSampler::with_collector(clock, FixedPowerCollector).expect("sampler");
        sampler.last_sample_at = origin + Duration::from_millis(100);

        let sample = sampler
            .sample_at(
                origin + Duration::from_millis(350),
                Utc::now() - chrono::Duration::hours(8),
            )
            .expect("resource sample");

        assert_eq!(sample.run_id, "run-shared");
        assert_eq!(sample.sequence, 0);
        assert_eq!(sample.interval_ms, 250);
        assert_eq!(sample.observed_offset_micros, 350_000);
        assert_eq!(sample.process.scope, ResourceScope::Process);
        assert_eq!(sample.system.scope, ResourceScope::System);
    }

    #[test]
    fn resource_sampler_platform_collector_never_infers_energy_from_cpu() {
        let power = PlatformPowerCollector.collect();
        assert!(!power.collector.is_empty());
        assert!(!power.method.is_empty());
        assert_eq!(
            power.energy_impact,
            Observation::Unknown {
                reason: UnknownReason::EnergyImpactNotMeasured
            }
        );
        assert!(!power.has_measured_energy_impact());
    }
}
