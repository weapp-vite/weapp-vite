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

it('redacts encoded graph protocol owners on Windows and POSIX', () => {
  for (const root of ['C:/Users/tester/project', '/home/tester/project']) {
    const owner = `${root}/src/pages/index.vue`
    const value = `weapp-vite:logical-entry:page:${encodeURIComponent(owner)}.js`
    const result = sanitizeBenchmarkDevLog(value, root)
    expect(result).toBe('weapp-vite:logical-entry:page:<repo>/src/pages/index.vue.js')
    expect(result).not.toMatch(/tester|%2f|%3a/i)
  }
})

it('redacts absolute paths embedded in bundler identifiers without losing their correlation', () => {
  const roots = ['/home/example-user/project-name', 'C:/Users/example-user/project-name']
  for (const root of roots) {
    const encoded = encodeURIComponent(`${root}/src/entry.ts`).replaceAll('%', '_').replaceAll(/[^\w$]/g, '_')
    const identifier = `owner_${encoded}_module`
    const source = `const ${identifier} = 'marker'; export { ${identifier} };`
    const result = sanitizeBenchmarkDevLog(source, root, '/unrelated-home')
    expect(result).not.toMatch(/example_user|project_name|_2f|_3a/i)
    expect(result).toContain('\'marker\'')
    const labels = result.match(/<path-derived-id:[a-f0-9]+>/g)
    expect(labels).toHaveLength(2)
    expect(labels![0]).toBe(labels![1])
  }
})
