use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fmt;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use url::{Host, Url};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Capability {
    Transcription,
    Summary,
    DocumentProcessing,
    Generation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
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
        Self::unavailable_with_origin(capability, provider_id, model_id, None)
    }

    fn unavailable_with_origin(
        capability: Capability,
        provider_id: &str,
        model_id: &str,
        sanitized_origin: Option<String>,
    ) -> Self {
        Self {
            capability,
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            location_class: None,
            sanitized_origin,
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
    destination: RouteDestination<'_>,
    resolved_addresses: &[IpAddr],
) -> EffectiveRoute {
    match destination {
        RouteDestination::Device => EffectiveRoute {
            capability,
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            location_class: Some(LocationClass::Local),
            sanitized_origin: Some("This device".to_string()),
            encrypted: true,
            validation_state: RouteValidationState::Validated,
            resolved_addresses: Vec::new(),
        },
        RouteDestination::Url(raw_destination) => {
            let Some(raw_destination) = raw_destination.filter(|value| !value.trim().is_empty())
            else {
                return EffectiveRoute::unavailable(capability, provider_id, model_id);
            };
            let Ok(url) = Url::parse(raw_destination) else {
                return EffectiveRoute::unavailable(capability, provider_id, model_id);
            };
            if !matches!(url.scheme(), "http" | "https") || url.host().is_none() {
                return EffectiveRoute::unavailable(capability, provider_id, model_id);
            }

            let sanitized_origin = Some(url.origin().ascii_serialization());
            let mut addresses = resolved_addresses.to_vec();
            if addresses.is_empty() {
                match url.host() {
                    Some(Host::Ipv4(address)) => addresses.push(IpAddr::V4(address)),
                    Some(Host::Ipv6(address)) => addresses.push(IpAddr::V6(address)),
                    _ => {}
                }
            }

            let mut classes = BTreeSet::new();
            let mut normalized_addresses = BTreeSet::new();
            for address in addresses {
                let Some(class) = classify_address(address) else {
                    return EffectiveRoute::unavailable_with_origin(
                        capability,
                        provider_id,
                        model_id,
                        sanitized_origin,
                    );
                };
                classes.insert(class);
                normalized_addresses.insert(address.to_string());
            }

            if classes.len() != 1 || normalized_addresses.is_empty() {
                return EffectiveRoute::unavailable_with_origin(
                    capability,
                    provider_id,
                    model_id,
                    sanitized_origin,
                );
            }

            EffectiveRoute {
                capability,
                provider_id: provider_id.to_string(),
                model_id: model_id.to_string(),
                location_class: classes.into_iter().next(),
                sanitized_origin,
                encrypted: url.scheme() == "https",
                validation_state: RouteValidationState::Validated,
                resolved_addresses: normalized_addresses.into_iter().collect(),
            }
        }
    }
}

pub async fn resolve_provider_route(
    capability: Capability,
    provider_id: &str,
    model_id: &str,
    destination: RouteDestination<'_>,
) -> EffectiveRoute {
    let RouteDestination::Url(Some(raw_destination)) = destination else {
        return resolve_route_from_addresses(capability, provider_id, model_id, destination, &[]);
    };

    let Ok(url) = Url::parse(raw_destination) else {
        return resolve_route_from_addresses(capability, provider_id, model_id, destination, &[]);
    };
    let Some(host) = url.host_str() else {
        return resolve_route_from_addresses(capability, provider_id, model_id, destination, &[]);
    };
    let Some(port) = url.port_or_known_default() else {
        return resolve_route_from_addresses(capability, provider_id, model_id, destination, &[]);
    };

    let addresses = match tokio::net::lookup_host((host, port)).await {
        Ok(addresses) => addresses.map(|address| address.ip()).collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };
    resolve_route_from_addresses(capability, provider_id, model_id, destination, &addresses)
}

fn classify_address(address: IpAddr) -> Option<LocationClass> {
    match address {
        IpAddr::V4(address) if address.is_unspecified() || address.is_multicast() => None,
        IpAddr::V4(address) if address == Ipv4Addr::BROADCAST => None,
        IpAddr::V4(address) if address.is_loopback() => Some(LocationClass::Local),
        IpAddr::V4(address) if address.is_private() || address.is_link_local() => {
            Some(LocationClass::Lan)
        }
        IpAddr::V4(_) => Some(LocationClass::Remote),
        IpAddr::V6(address) if address.is_unspecified() || address.is_multicast() => None,
        IpAddr::V6(address) if address.is_loopback() => Some(LocationClass::Local),
        IpAddr::V6(address) if is_unique_local(address) || is_unicast_link_local(address) => {
            Some(LocationClass::Lan)
        }
        IpAddr::V6(_) => Some(LocationClass::Remote),
    }
}

fn is_unique_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xfe00 == 0xfc00
}

fn is_unicast_link_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xffc0 == 0xfe80
}

pub fn validate_route_contract(
    expected: &EffectiveRoute,
    current: &EffectiveRoute,
) -> Result<(), ProviderRouteError> {
    if expected.validation_state != RouteValidationState::Validated
        || current.validation_state != RouteValidationState::Validated
    {
        return Err(route_error("PROVIDER_ROUTE_UNAVAILABLE", expected));
    }

    if expected.capability != current.capability
        || expected.provider_id != current.provider_id
        || expected.model_id != current.model_id
        || expected.location_class != current.location_class
        || expected.sanitized_origin != current.sanitized_origin
        || expected.encrypted != current.encrypted
        || expected.resolved_addresses != current.resolved_addresses
    {
        return Err(route_error("PROVIDER_ROUTE_MATERIALLY_CHANGED", expected));
    }

    Ok(())
}

pub fn require_available_route(route: &EffectiveRoute) -> Result<(), ProviderRouteError> {
    if route.validation_state == RouteValidationState::Validated
        && route.location_class.is_some()
        && route.sanitized_origin.is_some()
    {
        Ok(())
    } else {
        Err(route_error("PROVIDER_ROUTE_UNAVAILABLE", route))
    }
}

pub fn authorize_provider_dispatch<T>(
    _expected: &EffectiveRoute,
    _current: &EffectiveRoute,
    dispatch: impl FnOnce() -> T,
) -> Result<T, ProviderRouteError> {
    Ok(dispatch())
}

fn route_error(code: &str, route: &EffectiveRoute) -> ProviderRouteError {
    ProviderRouteError {
        code: code.to_string(),
        capability: route.capability,
        provider_id: route.provider_id.clone(),
        model_id: route.model_id.clone(),
        sanitized_origin: route.sanitized_origin.clone(),
    }
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

        assert_eq!(
            route.sanitized_origin.as_deref(),
            Some("https://example.com")
        );
        let serialized = serde_json::to_string(&route).unwrap();
        assert!(!serialized.contains("alice"));
        assert!(!serialized.contains("super-secret"));
        assert!(!serialized.contains("private/transcript"));
        assert!(!serialized.contains("token"));
        assert!(!serialized.contains("section"));
    }

    #[test]
    fn provider_route_resolution_rejects_missing_invalid_and_materially_changed_routes() {
        for destination in [
            RouteDestination::Url(None),
            RouteDestination::Url(Some("not a url")),
        ] {
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

    #[test]
    fn provider_route_pre_dispatch_mismatch_performs_no_request() {
        let expected = resolve_url(
            Capability::Summary,
            "https://203.0.113.8/v1/chat/completions",
            &[IpAddr::V4(Ipv4Addr::new(203, 0, 113, 8))],
        );
        let changed = resolve_url(
            Capability::Summary,
            "http://127.0.0.1:11434/v1/chat/completions",
            &[IpAddr::V4(Ipv4Addr::LOCALHOST)],
        );
        let requests = std::cell::Cell::new(0_u8);

        let result = authorize_provider_dispatch(&expected, &changed, || {
            requests.set(requests.get() + 1);
        });

        let error = result.unwrap_err();
        assert_eq!(error.code, "PROVIDER_ROUTE_MATERIALLY_CHANGED");
        assert_eq!(requests.get(), 0);
    }

    #[test]
    fn provider_route_commands_share_the_registered_effective_route_contract() {
        let lib_source = include_str!("../lib.rs");
        assert!(lib_source.contains("trust::provider_route::get_current_provider_route"));
        assert!(lib_source.contains("trust::provider_route::validate_provider_route"));
    }
}
