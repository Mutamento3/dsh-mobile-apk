#!/usr/bin/env node
// Local-only APK repack for shell/UI iteration. This intentionally skips every
// release gate and requires an existing snapshot asset in the APK project.
// Never publish this artifact: it is unsigned-release, ungated and unverified.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apkDir = existsSync(join(root, 'dsh-mobile-apk')) ? join(root, 'dsh-mobile-apk') : root
const snapshot = join(apkDir, 'app/src/main/assets/snapshot.tar.xz')
const output = join(root, '.deploy-tmp', 'dev-fast', 'dsh-mobile-apk-dev-fast.apk')
const localSdk = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : null
if (!process.env.ANDROID_HOME && localSdk && existsSync(localSdk)) {
  process.env.ANDROID_HOME = localSdk
}

if (!existsSync(snapshot)) {
  throw new Error('missing ' + snapshot + ': obtain a verified snapshot asset first; dev repack must not invent one')
}
mkdirSync(dirname(output), { recursive: true })
// EngineManager refuses to launch when its product ownership manifest is absent.
// Generate it from the exact embedded archive before Gradle packages assets.
execFileSync(process.execPath, [join(root, 'scripts', 'build-hard-manifest.mjs'),
  '--snapshot', snapshot, '--out', join(apkDir, 'app/src/main/assets/plugin-hard-manifest.json')],
  { cwd: root, stdio: 'inherit' })
// The bundle fingerprint is the OTHER half of the same gate, and it was missing here.
//
// EngineManager.snapshotFingerprintProblem() runs BEFORE the Hard manifest check, so a package
// without snapshot.sha256 is refused at the earlier gate (stage=snapshot-bundled-sha-missing) and
// never even reaches ensureHard. Symptom is nasty: am start -W still reports Status: ok with a
// plausible TotalTime, because it measures the Activity, not the engine — while boot-start stays 0
// and engine.log never appears. Anyone measuring a startup budget on such a package concludes
// "startup is fine", which is the opposite of the truth.
//
// build-apk-engine.mjs already writes this file for the release/Fast paths; dev repack simply
// forgot the step. Derive it from the same archive we are about to embed, never invent a value.
const fingerprint = join(apkDir, 'app/src/main/assets/snapshot.sha256')
const digest = createHash('sha256').update(readFileSync(snapshot)).digest('hex')
writeFileSync(fingerprint, digest, 'ascii')
console.log('snapshot.sha256 = ' + digest)
// Fail loudly if either gate asset is absent or inconsistent. Without this, a regression in the
// two generation steps above would silently produce a package whose engine never starts.
execFileSync(process.execPath, [join(root, 'scripts', 'check-snapshot-fingerprint.mjs'), '--require'],
  { cwd: root, stdio: 'inherit' })
const hardManifest = join(apkDir, 'app/src/main/assets/plugin-hard-manifest.json')
if (!existsSync(hardManifest) || readFileSync(hardManifest).length === 0) {
  throw new Error('missing or empty ' + hardManifest + ': engine would refuse to start')
}
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const args = [':app:assembleDebug', '--no-daemon', '--console=plain', '-PversionNameSuffix=-DEV-FAST']
console.log('DEV-FAST: all release gates skipped; artifact is for local verification only')
execFileSync(gradle, args, { cwd: apkDir, stdio: 'inherit', shell: process.platform === 'win32' })
const built = join(apkDir, 'app/build/outputs/apk/debug/app-debug.apk')
if (!existsSync(built)) throw new Error('gradle finished without ' + built)
copyFileSync(built, output)
console.log('DEV-FAST artifact: ' + output)
console.log('Install with adb install -r -t; do not attach this package to a release.')
