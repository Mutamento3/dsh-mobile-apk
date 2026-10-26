# Telemetry runtime dependency closure

## Failure and cause

The 0.2.1-rc.3 telemetry consumer declares exact experimental SDK versions. The installed snapshot instead inherited older third-party packages from its base. Its transformer 0.220.0 lacks LogsExporterMetricsHelper, while the consumer requires 0.222.0. Six direct requirements differ. This establishes the import failure, not causation for the separate startup-budget failure in #643.

## Change under validation

Pin an isolated eight-package OpenTelemetry closure under dsh-otel, and the required api-logs version under session-telemetry-otel. Leave unrelated consumers' older root packages intact. The archive gate retains dependency requirement maps and checks exact versions using consumer-local nested resolution, including transitive requirements, for the mounted telemetry consumers. Missing packages and stale nested copies fail.

## Evidence and pending qualification

The actual gate function and overlay contract pass eleven regressions. Disabling its version comparison causes three regressions to fail; the source is restored. Eight registry archives were checked against their SHA-512 integrity metadata. The device version inventory is retained without credentials.

Snapshot construction, actual entry import and service readiness, startup comparisons, CDP and portrait/landscape ADB tasks are still pending. No PR or release qualification is claimed. The configuration and gate are mirrored build inputs: the APK repository change must land before the coordinator counterpart. The current coordinator checkout was not found locally and its private remote was unavailable to the configured account; do not weaken the mirror requirement.
