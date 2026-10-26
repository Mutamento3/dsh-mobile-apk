/** Unsaved model fields accepted from an explicit clipboard action. */
export interface ClipboardModelConfig {
  apiKey?: string
  baseURL?: string
  model?: string
}

/** Bounded, value-free failures suitable for a credential import notice. */
export type ClipboardConfigFailure = 'empty' | 'too-large' | 'invalid-format' | 'unknown-field' | 'duplicate-field' | 'invalid-value'

/** A parser failure never includes clipboard contents or credential fragments. */
export class ClipboardConfigError extends Error {
  constructor(readonly code: ClipboardConfigFailure) {
    super(code)
    this.name = 'ClipboardConfigError'
  }
}

const MAX_TEXT = 16_384
const aliases: Readonly<Record<string, keyof ClipboardModelConfig>> = Object.freeze({
  apiKey: 'apiKey', api_key: 'apiKey', API_KEY: 'apiKey', key: 'apiKey',
  baseURL: 'baseURL', baseUrl: 'baseURL', base_url: 'baseURL', BASE_URL: 'baseURL',
  model: 'model', modelId: 'model', model_id: 'model', MODEL: 'model',
})

/** Validate a flat field without evaluating shell syntax or exposing its value in errors. */
function put(config: ClipboardModelConfig, name: string, raw: unknown): void {
  const key = Object.prototype.hasOwnProperty.call(aliases, name) ? aliases[name] : undefined
  if (!key) throw new ClipboardConfigError('unknown-field')
  if (Object.prototype.hasOwnProperty.call(config, key)) throw new ClipboardConfigError('duplicate-field')
  if (typeof raw !== 'string') throw new ClipboardConfigError('invalid-value')
  const value = raw.trim()
  if (!value || value.length > (key === 'apiKey' ? 4096 : 2048) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ClipboardConfigError('invalid-value')
  }
  if (key === 'baseURL') {
    let url: URL
    try { url = new URL(value) } catch { throw new ClipboardConfigError('invalid-value') }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new ClipboardConfigError('invalid-value')
    }
  }
  config[key] = value
}

/**
 * Parse a flat JSON object, key=value lines, or a single API key. The result is
 * only a draft: this module performs no clipboard, network, storage or settings writes.
 * Duplicate JSON keys are rejected before JSON.parse can silently keep the last value.
 */
export function parseClipboardModelConfig(text: string): ClipboardModelConfig {
  if (text.length > MAX_TEXT) throw new ClipboardConfigError('too-large')
  const source = text.trim()
  if (!source) throw new ClipboardConfigError('empty')
  if (source.startsWith('[')) throw new ClipboardConfigError('invalid-format')
  const config: ClipboardModelConfig = {}
  if (source.startsWith('{')) {
    // This deliberately supports only string-valued flat objects. Tokenizing the
    // members also prevents escaped aliases and duplicate names from bypassing put.
    const pair = /\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*/y
    let offset = 1
    while (offset < source.length) {
      pair.lastIndex = offset
      const match = pair.exec(source)
      if (!match) throw new ClipboardConfigError('invalid-format')
      let name: string
      let value: string
      try { name = JSON.parse(match[1]); value = JSON.parse(match[2]) } catch { throw new ClipboardConfigError('invalid-format') }
      put(config, name, value)
      offset = pair.lastIndex
      if (source[offset] === '}' && offset === source.length - 1) return config
      if (source[offset] !== ',') throw new ClipboardConfigError('invalid-format')
      offset++
    }
    throw new ClipboardConfigError('invalid-format')
  }
  if (!source.includes('\n') && !/^[A-Za-z_][A-Za-z_0-9]*\s*=/.test(source)) {
    put(config, 'apiKey', source)
    return config
  }
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue
    const separator = line.indexOf('=')
    if (separator < 1) throw new ClipboardConfigError('invalid-format')
    put(config, line.slice(0, separator).trim(), line.slice(separator + 1))
  }
  if (Object.keys(config).length === 0) throw new ClipboardConfigError('empty')
  return config
}
