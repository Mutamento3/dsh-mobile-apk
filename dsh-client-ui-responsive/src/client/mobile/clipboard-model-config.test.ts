import { describe, expect, it } from 'vitest'
import { ClipboardConfigError, parseClipboardModelConfig } from './clipboard-model-config.ts'

describe('clipboard model configuration drafts', () => {
  it('accepts flat JSON aliases without saving anything', () => {
    expect(parseClipboardModelConfig('{"api_key":"test-key","baseUrl":"https://example.test/v1","model":"demo"}'))
      .toEqual({ apiKey: 'test-key', baseURL: 'https://example.test/v1', model: 'demo' })
  })
  it('accepts CRLF key=value text and preserves equals inside values', () => {
    expect(parseClipboardModelConfig('API_KEY=test==\r\nBASE_URL=http://127.0.0.1:9000/v1\r\nMODEL=demo'))
      .toEqual({ apiKey: 'test==', baseURL: 'http://127.0.0.1:9000/v1', model: 'demo' })
  })
  it('accepts a plain single-line key', () => {
    expect(parseClipboardModelConfig(' test-key ')).toEqual({ apiKey: 'test-key' })
  })
  it('trims blank leading and trailing lines around one plain key', () => {
    expect(parseClipboardModelConfig('\n test-key\r\n')).toEqual({ apiKey: 'test-key' })
  })
  for (const text of ['{"apiKey":"first","apiKey":"second"}', '{"apiKey":"first","api_key":"second"}',
    '{"apiKey":"first","api\\u004bey":"second"}', 'apiKey=first\nAPI_KEY=second']) {
    it('rejects duplicate or aliased fields: ' + text.replace(/first|second/g, 'redacted'), () => {
      expect(() => parseClipboardModelConfig(text)).toThrow('duplicate-field')
    })
  }
  for (const text of ['{"__proto__":"x"}', '["test-key"]', '{"model":{"id":"demo"}}', '{"model":"demo",}',
    'model=demo\nunknown=x', 'BASE_URL=javascript:alert(1)', 'BASE_URL=https://user:secret@example.test',
    'BASE_URL=https://example.test/?key=secret', 'MODEL=one\ntwo', 'API_KEY=one\u0000two']) {
    it('rejects malformed or unsupported input without returning a partial draft', () => {
      expect(() => parseClipboardModelConfig(text)).toThrow(ClipboardConfigError)
    })
  }
  it('rejects empty and oversized input', () => {
    expect(() => parseClipboardModelConfig(' ')).toThrow('empty')
    expect(() => parseClipboardModelConfig('x'.repeat(16_385))).toThrow('too-large')
  })
  it('keeps rejected secrets out of the error object and stack', () => {
    const secret = 'fixture-only-private-value'
    try { parseClipboardModelConfig('unknown=' + secret); throw new Error('accepted') } catch (error) {
      expect(error).toBeInstanceOf(ClipboardConfigError)
      expect(String(error)).not.toContain(secret)
      expect((error as Error).stack).not.toContain(secret)
      expect(JSON.stringify(error)).not.toContain(secret)
    }
  })
})
