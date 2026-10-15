import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const code = `require('pkg'); wx.request();`
const valid = {
  requires: [{ start: 8, end: 13, importee: 'pkg' }],
  platformApiRanges: [{ start: 16, end: 18 }],
  localRootFacts: [{ kind: 'require', requireIndex: 0 }],
}
let directory: string | undefined

async function fixture(body: string) {
  directory = await mkdtemp(join(tmpdir(), 'npm-chunk-native-'))
  const filename = join(directory, 'binding.cjs')
  await writeFile(filename, `const valid = ${JSON.stringify(valid)}; ${body}`)
  vi.stubEnv('WEAPP_VITE_NATIVE', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_NPM_CHUNK', '1')
  vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', filename)
  vi.resetModules()
  return await import('./native')
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.resetModules()
  if (directory) {
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }
})

describe('native npm chunk batch boundary', () => {
  it('stays disabled unless the npm chunk experiment is explicitly enabled', async () => {
    const native = await fixture('exports.analyzeNpmChunksNative = () => { throw new Error("must stay cold") }')
    vi.stubEnv('WEAPP_VITE_NATIVE_NPM_CHUNK', '')
    expect(native.analyzeNpmChunksWithNative([{ code }])).toBeUndefined()
  })

  it('crosses the addon once and retains valid neighboring items', async () => {
    const native = await fixture('let count = 0; exports.analyzeNpmChunksNative = () => { if (++count > 1) throw new Error("repeated native call"); return [valid, null, { ...valid, requires: [null] }, valid] }')
    expect(native.analyzeNpmChunksWithNative(Array.from({ length: 4 }, () => ({ code })))).toEqual([
      valid,
      null,
      null,
      valid,
    ])
  })

  it.each([
    '',
    'exports.analyzeNpmChunksNative = () => { throw new Error("native failed") }',
    'exports.analyzeNpmChunksNative = () => []',
    'exports.analyzeNpmChunksNative = () => new Array(2)',
    'exports.analyzeNpmChunksNative = () => null',
  ])('hands each rejected item back to JS without leaf native retries: %s', async (body) => {
    const native = await fixture(`${body}; exports.analyzeScriptNative = () => { throw new Error("unexpected leaf call") }`)
    expect(native.analyzeNpmChunksWithNative([{ code }, { code }])).toEqual([null, null])
  })
})
