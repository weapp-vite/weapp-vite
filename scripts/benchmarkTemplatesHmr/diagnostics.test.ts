import { describe, expect, it } from 'vitest'
import { sanitizeBenchmarkDevLog } from './diagnostics'

describe('template benchmark diagnostics', () => {
  it('preserves errors and relative files while redacting paths and secrets', () => {
    const result = sanitizeBenchmarkDevLog([
      'Error: failed to transform /home/tester/project/src/pages/index.vue',
      '/home/tester/.cache/debug.log',
      'token=example-secret password=another-secret appid=example-id',
      '{"appid":"quoted-id","authorization":"Bearer quoted-secret"}',
      'contact=developer@example.com',
    ].join('\r\n'), '/home/tester/project', '/home/tester')
    expect(result).toContain('Error: failed to transform <repo>/src/pages/index.vue')
    expect(result).toContain('<home>/.cache/debug.log')
    expect(result).not.toMatch(/tester|example-secret|another-secret|example-id|quoted-id|quoted-secret|developer@example\.com|\r/)
  })

  it('normalizes Windows report paths and redacts unrelated temporary files', () => {
    const result = sanitizeBenchmarkDevLog('C:\\Users\\tester\\project\\src\\index.ts /tmp/build/cache.log', 'C:\\Users\\tester\\project', 'C:\\Users\\tester')
    expect(result).toBe('<repo>/src/index.ts <external-path>')
  })
})
