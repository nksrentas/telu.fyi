use serde::{Deserialize, Serialize};
use std::fmt;
use std::net::IpAddr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Transcription,
    Summary,
    DocumentProcessing,
    Generation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocationClass {
    Local,
    Lan,
    Remote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RouteValidationState {
    Validated,
    Unavailable,
    MateriallyChanged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RouteDestination<'a> {
    Device,
    Url(Option<&'a str>),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveRoute {
    pub capability: Capability,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: Option<LocationClass>,
    pub sanitized_origin: Option<String>,
    pub encrypted: bool,
    pub validation_state: RouteValidationState,
    pub resolved_addresses: Vec<String>,
}

impl EffectiveRoute {
    fn unavailable(capability: Capability, provider_id: &str, model_id: &str) -> Self {
        Self {
            capability,
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            location_class: None,
            sanitized_origin: None,
            encrypted: false,
            validation_state: RouteValidationState::Unavailable,
            resolved_addresses: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRouteError {
    pub code: String,
    pub capability: Capability,
    pub provider_id: String,
    pub model_id: String,
    pub sanitized_origin: Option<String>,
}

impl fmt::Display for ProviderRouteError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} route is unavailable for provider '{}'",
            match self.capability {
                Capability::Transcription => "Transcription",
                Capability::Summary => "Summary",
                Capability::DocumentProcessing => "Document processing",
                Capability::Generation => "Generation",
            },
            self.provider_id
        )
    }
}

impl std::error::Error for ProviderRouteError {}

pub fn resolve_route_from_addresses(
    capability: Capability,
    provider_id: &str,
    model_id: &str,
    _destination: RouteDestination<'_>,
    _resolved_addresses: &[IpAddr],
) -> EffectiveRoute {
    EffectiveRoute::unavailable(capability, provider_id, model_id)
}

pub fn validate_route_contract(
    expected: &EffectiveRoute,
    _current: &EffectiveRoute,
) -> Result<(), ProviderRouteError> {
    Err(ProviderRouteError {
        code: "PROVIDER_ROUTE_UNAVAILABLE".to_string(),
        capability: expected.capability,
        provider_id: expected.provider_id.clone(),
        model_id: expected.model_id.clone(),
        sanitized_origin: expected.sanitized_origin.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

    fn resolve_url(capability: Capability, url: &str, addresses: &[IpAddr]) -> EffectiveRoute {
        resolve_route_from_addresses(
            capability,
            "configured-provider",
            "configured-model",
            RouteDestination::Url(Some(url)),
            addresses,
        )
    }

    #[test]
    fn provider_route_resolution_classifies_device_loopback_private_and_public_destinations() {
        let device = resolve_route_from_addresses(
            Capability::Transcription,
            "parakeet",
            "parakeet-local",
            RouteDestination::Device,
            &[],
        );
        assert_eq!(device.location_class, Some(LocationClass::Local));
        assert_eq!(device.sanitized_origin.as_deref(), Some("This device"));

        let cases = [
            (
                "http://localhost:11434/v1/chat/completions",
                IpAddr::V4(Ipv4Addr::LOCALHOST),
                LocationClass::Local,
            ),
            (
                "http://192.168.10.8:11434/v1/chat/completions",
                IpAddr::V4(Ipv4Addr::new(192, 168, 10, 8)),
                LocationClass::Lan,
            ),
            (
                "https://203.0.113.8/v1/chat/completions",
                IpAddr::V4(Ipv4Addr::new(203, 0, 113, 8)),
                LocationClass::Remote,
            ),
            (
                "http://[::1]:11434/v1/chat/completions",
                IpAddr::V6(Ipv6Addr::LOCALHOST),
                LocationClass::Local,
            ),
        ];

        for (url, address, expected) in cases {
            let route = resolve_url(Capability::Summary, url, &[address]);
            assert_eq!(route.location_class, Some(expected), "url={url}");
            assert_eq!(route.validation_state, RouteValidationState::Validated);
        }
    }

    #[test]
    fn provider_route_resolution_redacts_credentials_query_fragment_and_sensitive_path() {
        let raw = "https://alice:super-secret@example.com/private/transcript?token=secret#section";
        let route = resolve_url(
            Capability::Summary,
            raw,
            &[IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))],
        );

        assert_eq!(route.sanitized_origin.as_deref(), Some("https://example.com"));
        let serialized = serde_json::to_string(&route).unwrap();
        assert!(!serialized.contains("alice"));
        assert!(!serialized.contains("super-secret"));
        assert!(!serialized.contains("private/transcript"));
        assert!(!serialized.contains("token"));
        assert!(!serialized.contains("section"));
    }

    #[test]
    fn provider_route_resolution_rejects_missing_invalid_and_materially_changed_routes() {
        for destination in [RouteDestination::Url(None), RouteDestination::Url(Some("not a url"))] {
            let route = resolve_route_from_addresses(
                Capability::Summary,
                "custom-openai",
                "custom-model",
                destination,
                &[],
            );
            assert_eq!(route.validation_state, RouteValidationState::Unavailable);
            assert_eq!(route.location_class, None);
        }

        let expected = resolve_url(
            Capability::Summary,
            "https://route.example/v1",
            &[IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))],
        );
        let changed = resolve_url(
            Capability::Summary,
            "https://route.example/v1",
            &[IpAddr::V4(Ipv4Addr::new(10, 0, 0, 9))],
        );
        let error = validate_route_contract(&expected, &changed).unwrap_err();
        assert_eq!(error.code, "PROVIDER_ROUTE_MATERIALLY_CHANGED");
        assert!(!error.to_string().contains("93.184.216.34"));
        assert!(!error.to_string().contains("10.0.0.9"));
    }

    #[test]
    fn provider_route_resolution_keeps_capability_identity_for_shared_destination() {
        let address = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        let transcription = resolve_url(
            Capability::Transcription,
            "http://127.0.0.1:11434/v1/chat/completions",
            &[address],
        );
        let summary = resolve_url(
            Capability::Summary,
            "http://127.0.0.1:11434/v1/chat/completions",
            &[address],
        );

        assert_eq!(transcription.capability, Capability::Transcription);
        assert_eq!(summary.capability, Capability::Summary);
        assert_ne!(transcription.capability, summary.capability);
        assert_eq!(transcription.sanitized_origin, summary.sanitized_origin);
    }
}
