import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { runWeappViteCLI } from '../bin/bootstrap.js'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { engines: { node: string } }

describe('Node compatibility before loading the CLI dependency graph', () => {
  it.each(['build', 'dev', 'prepare', 'accept', 'mcp'])('rejects unsupported Node before %s imports', async (command) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: [command], nodeVersion: '20.19.0', importer }))
      .rejects
      .toThrow(manifest.engines.node)
    expect(importer).not.toHaveBeenCalled()
  })

  it.each(['22.18.0', '24.11.0', '26.0.0'])('loads the CLI on supported Node %s', async (nodeVersion) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer })).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
  })

  it.each(['22.17.1', '23.11.0', '24.10.0', '25.9.0'])('rejects Node %s with its actual version and required range', async (nodeVersion) => {
    const importer = vi.fn()
    await expect(runWeappViteCLI({ argv: ['build'], nodeVersion, importer })).rejects.toThrow(nodeVersion)
    expect(importer).not.toHaveBeenCalled()
  })
})
