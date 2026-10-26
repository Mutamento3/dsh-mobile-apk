# Telemetry runtime dependency closure

## Failure and cause

The 0.2.1-rc.3 telemetry consumer declares exact experimental SDK versions. The installed snapshot instead inherited older third-party packages from its base. Its transformer 0.220.0 lacks LogsExporterMetricsHelper, while the consumer requires 0.222.0. Six direct requirements differ. This establishes the import failure, not causation for the separate startup-budget failure in #643.

## Change under validation

Pin an isolated eight-package OpenTelemetry closure under dsh-otel, and the required api-logs version under session-telemetry-otel. Leave unrelated consumers' older root packages intact. The archive gate retains dependency requirement maps and checks exact versions using consumer-local nested resolution, including transitive requirements, for the mounted telemetry consumers. Missing packages and stale nested copies fail.

## Evidence and pending qualification

The actual gate function and overlay contract pass eleven regressions. Disabling its version comparison causes three regressions to fail; the source is restored. Eight registry archives were checked against their SHA-512 integrity metadata. The device version inventory is retained without credentials.

The actual old device entry import fails with the expected missing-helper SyntaxError; the old archive is rejected with seven telemetry exact-version mismatches. The fixed stage entry imports successfully with the helper present. The rebuilt raw snapshot SHA-256 is aeef7c266a2adf8f7cc98eb79956e481e6156b908b2107b47c998fbf21b9753b and passes the archive gate (481 package-version assertions, no runtime closure gaps). Actual APK installation, device import/service readiness, startup comparisons, CDP and portrait/landscape ADB tasks are still pending. No PR or release qualification is claimed. The configuration and gate are mirrored build inputs: the APK repository change must land before the coordinator counterpart. The current coordinator checkout was not found locally and its private remote was unavailable to the configured account; do not weaken the mirror requirement.


The first build attempt used Node 22, whose TAP output was rejected by an existing spec-summary parser despite eight passing pi-toolcall tests. Node 24.11.0 then exposed a dangling-link removal regression in an isolated probe and failed the keyring copy step. Official Node 24.22.1 archives were SHA-256 verified, its probe removed the link correctly, and the unchanged snapshot builder completed. These failed attempts remain recorded; no gate was bypassed or changed to accommodate them. The generated fixture capture metadata is refreshed to bind the changed overlay bytes.
