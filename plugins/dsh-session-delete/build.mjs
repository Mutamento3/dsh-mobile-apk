// Materializes lib/ from src/ for the Android injection chain.
//
// The snapshot injector carries only `lib/**` plus package.json for
// @dsh-android packages, so a source-only package would arrive without code.
// Copying src/ into lib/ keeps the committed tree source-only while giving the
// chain something to inject; intra-package imports stay relative (`./session-delete.js`).
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lib = join(here, 'lib')
await rm(lib, { recursive: true, force: true })
await mkdir(lib, { recursive: true })
await cp(join(here, 'src'), lib, { recursive: true })
console.log('dsh-session-delete: lib/ rebuilt from src/ (' + (await readdir(lib)).length + ' entries)')
