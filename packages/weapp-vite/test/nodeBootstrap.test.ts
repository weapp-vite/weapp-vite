import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runWeappViteCLI } from '../bin/bootstrap.js'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { engines: { node: string } }

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubBunRuntime(bun: unknown) {
  const runtime = {
    ...process,
    versions: { ...process.versions, node: '26.3.0', bun },
    exit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
  vi.stubGlobal('process', runtime)
  return runtime
}

describe('Node compatibility before loading the CLI dependency graph', () => {
  it.each(['build', 'dev', 'prepare', 'accept', 'mcp'])('rejects unsupported Node before %s imports', async (command) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: [command], nodeVersion: '20.19.0', importer }))
      .rejects
      .toThrow(manifest.engines.node)
    expect(importer).not.toHaveBeenCalled()
  })

  it.each(['22.23.4', '24.22.1', '26.12.1'])('loads the CLI on supported Node %s', async (nodeVersion) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
  })

  it.each(['22.23.3', '23.11.0', '24.22.0', '25.9.0', '26.12.0'])('rejects Node %s with its actual version and required range', async (nodeVersion) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer })).rejects.toThrow(nodeVersion)
    expect(importer).not.toHaveBeenCalled()
  })
})

describe('Bun identity before loading the CLI dependency graph', () => {
  for (const bun of ['1.4.2', '1.4.4']) {
    it.each(['build', 'dev', 'prepare', 'accept', 'mcp'])(`loads %s under Bun ${bun} independently of its Node compatibility version`, async (command) => {
      stubBunRuntime(bun)
      const importer = vi.fn()
      await expect(runWeappViteCLI({ argv: [command], importer })).resolves.toBe(true)
      expect(importer).toHaveBeenCalledOnce()
    })
  }

  it.each([undefined, '', true, {}])('rejects the same Node version when the Bun marker is invalid: %j', async (bun) => {
    const runtime = stubBunRuntime(bun)
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['prepare'], importer })).rejects.toThrow('26.3.0')
    expect(importer).not.toHaveBeenCalled()
    expect(runtime.on).not.toHaveBeenCalled()
  })

  it('does not treat a global Bun polyfill as the actual runtime identity', async () => {
    stubBunRuntime(undefined)
    vi.stubGlobal('Bun', { version: '1.4.4' })
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], importer })).rejects.toThrow(manifest.engines.node)
    expect(importer).not.toHaveBeenCalled()
  })

  it.each(['build', 'dev', 'accept', 'mcp'])('preserves the original Bun %s importer failure', async (command) => {
    stubBunRuntime('1.4.4')
    const error = new Error('CLI dependency import failed')
    const importer = vi.fn().mockRejectedValue(error)
    await expect(runWeappViteCLI({ argv: [command], importer })).rejects.toBe(error)
    expect(importer).toHaveBeenCalledOnce()
  })

  it('retains the existing prepare importer tolerance under Bun', async () => {
    stubBunRuntime('1.4.4')
    const write = vi.fn()
    const importer = vi.fn().mockRejectedValue(new Error('Cannot find CLI dependency'))
    await expect(runWeappViteCLI({ argv: ['prepare'], importer, write })).resolves.toBe(false)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledExactlyOnceWith('[prepare] 跳过 .weapp-vite 支持文件预生成：Cannot find CLI dependency')
  })
})
