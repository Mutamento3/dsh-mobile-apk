# Settle normalization retention after publication

The normalization caller created a successful backup before trying to publish the normalized patch. That operation immediately trimmed successful history. If writing the temporary patch then failed, creating a separate failed backup could not restore the successful history already removed.

The Android regression fills all three successful slots, obstructs the temporary publication path with a directory, and invokes the actual EngineManager normalization entry against an isolated profile. Before this fix, live bytes and the completion marker were protected, but the successful backup set changed. The regression failed on a device package that already contained the separate backup ownership fix, establishing that settlement order is an independent defect.

`ProfileNormalizationPublication` first exclusively creates, forces and verifies a complete pending original. It invokes the existing synchronous live publication path and selects the successful or failed retention group only after that outcome is known. A classification failure retains the pending original and prevents the normalization completion marker. Interrupted pending originals have a separate bounded cleanup policy that excludes the active attempt, foreign names, directories and symbolic links.

The classified backup allocator remains separate: this change does not replace its filename ownership policy or redesign the existing live-file publication fallback.

Validation:

- All 173 JVM classes, 1878 tests, pass with no failures, errors or skips, including six new publication tests. The count gate passes; only the new class raises its recorded baseline.
- The pre-fix Android regression fails as expected on the backup-ownership development package. The fixed development package passes all five Android cases: failed publication with full history, four consecutive failures, successful publication with both quotas full, unavailable pending storage and failed final settlement retaining a complete original.
- Portrait and landscape WebView checks each pass all 46 assertions. The first post-instrumentation engine start exceeded its 90-second budget and subsequently recovered automatically; the final package also exceeded that budget after instrumentation. Neither is counted as a passing startup test. Issue #643 tracks this separate qualification failure. A telemetry import error and loader wait are observed, but their causal relationship to startup is not established.
- Actual portrait and landscape console tasks each pass ten steps covering creation, backup, modification, restoration, byte comparison and cleanup. Both test directories are absent afterwards. Rotation preferences are restored.
- The final package is rebuilt and installed after the logging-only refinement below; all five Android cases pass again. The test package is unchanged. Evidence files use the `profile-publication-` prefix, including full-build, final-device, WebView and console logs.

The final logging-only refinement says the original is protected, rather than asserting a backup exists when pending creation itself failed. Local development packages are not release candidates. UI task evidence covers unchanged UI and publication behavior, not release packaging or physical-device qualification.
