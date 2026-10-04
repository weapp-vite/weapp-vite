import { expect, it } from 'vitest'
import { sanitizeScriptDiagnostic } from './diagnostics'

it('scrubs raw Windows paths and repeatedly escaped outputs without changing the original sample', () => {
  const root = 'C:\\Users\\runner\\work\\project\\'
  const filename = `${root}src\\page.ts`
  const original = {
    message: filename,
    posix: filename.replaceAll('\\', '/'),
    output: JSON.stringify({ error: { filename }, value: { code: `const file = ${JSON.stringify(filename)}` } }),
    nested: JSON.stringify({ output: JSON.stringify({ filename }) }),
    unchanged: [0, null, false, 'keep'],
  }
  const before = JSON.stringify(original)
  const saved = sanitizeScriptDiagnostic(original, [root]) as typeof original
  expect(saved.message).toBe('<workspace>/src\\page.ts')
  expect(saved.posix).toBe('<workspace>/src/page.ts')
  expect(JSON.parse(saved.output)).toEqual({ error: { filename: '<workspace>/src\\page.ts' }, value: { code: 'const file = "<workspace>/src\\\\page.ts"' } })
  const nested = JSON.parse(saved.nested) as { output: string }
  expect(JSON.parse(nested.output)).toEqual({ filename: '<workspace>/src\\page.ts' })
  expect(saved.unchanged).toEqual(original.unchanged)
  expect(JSON.stringify(saved)).not.toContain('Users')
  expect(JSON.stringify(original)).toBe(before)
})

it('scrubs POSIX roots and diagnostic map keys while keeping unrelated text', () => {
  expect(sanitizeScriptDiagnostic({ '/tmp/owned/src.ts': '/tmp/owned/src.ts', 'other': '/tmp/another/src.ts' }, ['/tmp/owned/']))
    .toEqual({ '<workspace>/src.ts': '<workspace>/src.ts', 'other': '/tmp/another/src.ts' })
})
