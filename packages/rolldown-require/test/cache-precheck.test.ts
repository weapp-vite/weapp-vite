import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'

const tmpRoot = () => fsp.mkdtemp(path.join(os.tmpdir(), 'rolldown-require-cache-precheck-'))

it('skips bundler when cache is valid', async () => {
  const root = await tmpRoot()
  const cacheDir = path.join(root, '.cache')
  const entry = path.join(root, 'entry.ts')
  const dep = path.join(root, 'dep.ts')

  await fsp.writeFile(dep, 'export const label = "v1"', 'utf8')
  await fsp.writeFile(entry, 'import { label } from "./dep"; export const val = label', 'utf8')

  const { bundleRequire: bundleRequireReal } = await import('../src/index')
  const first = await bundleRequireReal({
    filepath: entry,
    cache: { enabled: true, dir: cacheDir },
  })
  expect(first.mod.val).toBe('v1')

  vi.resetModules()
  const bundleFileMock = vi.fn(async () => {
    throw new Error('bundleFile should not be called on cache hit')
  })
  vi.doMock('../src/bundler', () => ({ bundleFile: bundleFileMock }))

  try {
    const { bundleRequire } = await import('../src/index')
    const second = await bundleRequire({
      filepath: entry,
      cache: { enabled: true, dir: cacheDir },
    })
    expect(second.mod.val).toBe('v1')
    expect(bundleFileMock).not.toHaveBeenCalled()
  }
  finally {
    vi.unmock('../src/bundler')
    await fsp.rm(root, { recursive: true, force: true })
  }
})
