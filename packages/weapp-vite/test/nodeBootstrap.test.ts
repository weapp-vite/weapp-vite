import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runWeappViteCLI } from '../bin/bootstrap.js'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { engines: { node: string } }

function stubRuntime(bun: unknown, node = '26.3.0') {
  const runtime = {
    ...process,
    versions: { ...process.versions, node, bun },
    exit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
  vi.stubGlobal('process', runtime)
  return runtime
}

beforeEach(() => {
  stubRuntime(undefined, '24.22.1')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Node compatibility before loading the CLI dependency graph', () => {
  it.each(['build', 'dev', 'prepare', 'accept', 'mcp'])('warns about unsupported Node before %s imports and continues', async (command) => {
    const write = vi.fn()
    const importer = vi.fn(() => {
      expect(write).toHaveBeenCalledOnce()
    })
    await expect(runWeappViteCLI({ argv: [command], nodeVersion: '20.19.0', importer, write })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith(expect.stringContaining('20.19.0'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining(manifest.engines.node))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('latest patch release of a supported Node.js LTS line for security fixes'))
  })

  it.each(['22.23.4', '24.22.1', '26.12.1'])('loads the CLI on supported Node %s', async (nodeVersion) => {
    const importer = vi.fn()
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer, write })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
  })

  it.each(['22.23.3', '23.11.0', '24.22.0', '25.9.0', '26.12.0'])('warns about Node %s with its actual version and recommended range', async (nodeVersion) => {
    const importer = vi.fn()
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer, write })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith(expect.stringContaining(nodeVersion))
    expect(write).toHaveBeenCalledWith(expect.stringContaining(manifest.engines.node))
  })

  it('writes the default warning to stderr without changing the exit status', async () => {
    const runtime = stubRuntime(undefined, '24.22.0')
    runtime.exitCode = undefined
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    await expect(runWeappViteCLI({ argv: ['build'], importer: vi.fn() })).resolves.toBe(true)
    expect(stderr).toHaveBeenCalledOnce()
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('WARN'))
    expect(stdout).not.toHaveBeenCalled()
    expect(runtime.exitCode).toBeUndefined()
    expect(runtime.exit).not.toHaveBeenCalled()
  })

  it.each(['build', 'dev', 'accept', 'mcp'])('preserves the original %s importer failure after a Node warning', async (command) => {
    const error = new Error('CLI dependency import failed')
    const importer = vi.fn().mockRejectedValue(error)
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: [command], nodeVersion: '24.22.0', importer, write })).rejects.toBe(error)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledOnce()
  })

  it('retains prepare importer tolerance after a Node warning', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('Cannot find CLI dependency'))
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: ['prepare'], nodeVersion: '24.22.0', importer, write })).resolves.toBe(false)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, expect.stringContaining(manifest.engines.node))
    expect(write).toHaveBeenNthCalledWith(2, '[prepare] 跳过 .weapp-vite 支持文件预生成：Cannot find CLI dependency')
  })
})

describe('Bun identity before loading the CLI dependency graph', () => {
  for (const bun of ['1.4.2', '1.4.4']) {
    it.each(['build', 'dev', 'prepare', 'accept', 'mcp'])(`loads %s under Bun ${bun} independently of its Node compatibility version`, async (command) => {
      stubRuntime(bun)
      const importer = vi.fn()
      const write = vi.fn()
      await expect(runWeappViteCLI({ argv: [command], importer, write })).resolves.toBe(true)
      expect(importer).toHaveBeenCalledOnce()
      expect(write).not.toHaveBeenCalled()
    })
  }

  it.each([undefined, '', true, {}])('warns about Node and continues when the Bun marker is invalid: %j', async (bun) => {
    const runtime = stubRuntime(bun)
    const importer = vi.fn()
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: ['prepare'], importer, write })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('26.3.0'))
    expect(runtime.on).toHaveBeenCalledWith('beforeExit', expect.any(Function))
  })

  it('does not treat a global Bun polyfill as the actual runtime identity', async () => {
    stubRuntime(undefined)
    vi.stubGlobal('Bun', { version: '1.4.4' })
    const importer = vi.fn()
    const write = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], importer, write })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(manifest.engines.node))
  })

  it.each(['build', 'dev', 'accept', 'mcp'])('preserves the original Bun %s importer failure', async (command) => {
    stubRuntime('1.4.4')
    const error = new Error('CLI dependency import failed')
    const importer = vi.fn().mockRejectedValue(error)
    await expect(runWeappViteCLI({ argv: [command], importer })).rejects.toBe(error)
    expect(importer).toHaveBeenCalledOnce()
  })

  it('retains the existing prepare importer tolerance under Bun', async () => {
    stubRuntime('1.4.4')
    const write = vi.fn()
    const importer = vi.fn().mockRejectedValue(new Error('Cannot find CLI dependency'))
    await expect(runWeappViteCLI({ argv: ['prepare'], importer, write })).resolves.toBe(false)
    expect(importer).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledExactlyOnceWith('[prepare] 跳过 .weapp-vite 支持文件预生成：Cannot find CLI dependency')
  })
})
