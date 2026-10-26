# Clipboard model configuration drafts

Work in progress for #584. No clipboard reader or settings write is wired yet; this parser alone does not provide the feature.

The upstream provider-card slot exposes provider metadata but no draft setters. The adapter must preserve the editor's own Apply operation rather than write settings or credentials behind it. The planned import starts from an explicit user action, previews the selected fields with a masked API key, and fills only the chosen editor's draft. A native clipboard reader must not expose background reads through an unrestricted synchronous bridge.

The initial parser accepts a flat JSON object, key=value lines, or a plain single-line key. It caps input at 16 KiB, bounds individual values, rejects duplicate keys including alias collisions and escaped JSON names, and refuses nested objects, arrays, unknown fields and credential-bearing endpoint URLs. It never evaluates shell syntax or includes clipboard values in failures. Tests cover parser contracts and value-free errors; a controlled mutation allowing duplicate fields fails four cases.

Validation completed: 19 focused Vitest cases, TypeScript typecheck and code-map validation. No feature device validation has occurred. Native consent/read, preview UI, React draft updates, build and immediate three-layer acceptance remain required before publishing a PR.
