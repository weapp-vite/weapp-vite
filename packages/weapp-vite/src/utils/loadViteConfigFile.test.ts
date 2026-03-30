import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalize } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadViteConfigFile } from './loadViteConfigFile'

const loadConfigFromFileMock = vi.hoisted(() => vi.fn())

vi.mock('vite', () => ({
  loadConfigFromFile: loadConfigFromFileMock,
}))

describe('loadViteConfigFile', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    loadConfigFromFileMock.mockReset()
    await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
  })

  it('does not rewrite weapp-vite subpath imports to workspace dist files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-config-'))
    tempDirs.push(tempDir)

    const configFile = path.join(tempDir, 'vite.config.ts')
    await fs.writeFile(
      configFile,
      `import { defineAppJson } from 'weapp-vite/json'

export default {
  plugins: [defineAppJson({})],
}
`,
    )

    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {},
      path: configFile,
      dependencies: [configFile],
    })

    await loadViteConfigFile(
      { command: 'serve', mode: 'development' },
      configFile,
      tempDir,
    )

    expect(loadConfigFromFileMock).toHaveBeenCalledTimes(1)
    expect(loadConfigFromFileMock).toHaveBeenCalledWith(
      { command: 'serve', mode: 'development' },
      configFile,
      tempDir,
      undefined,
      undefined,
      'bundle',
      undefined,
    )
  })

  it('resolves the default vite config file from configRoot', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-config-'))
    tempDirs.push(tempDir)

    const configFile = path.join(tempDir, 'vite.config.mts')
    await fs.writeFile(configFile, 'export default {}')

    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {},
      path: configFile,
      dependencies: [configFile],
    })

    await loadViteConfigFile(
      { command: 'build', mode: 'production' },
      undefined,
      tempDir,
    )

    expect(loadConfigFromFileMock).toHaveBeenCalledWith(
      { command: 'build', mode: 'production' },
      normalize(configFile),
      tempDir,
      undefined,
      undefined,
      'bundle',
      undefined,
    )
  })

  it('preserves an explicitly provided config loader', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-config-'))
    tempDirs.push(tempDir)

    const configFile = path.join(tempDir, 'vite.config.ts')
    await fs.writeFile(configFile, 'export default {}')

    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {},
      path: configFile,
      dependencies: [configFile],
    })

    await loadViteConfigFile(
      { command: 'serve', mode: 'development' },
      configFile,
      tempDir,
      undefined,
      undefined,
      'runner',
    )

    expect(loadConfigFromFileMock).toHaveBeenCalledWith(
      { command: 'serve', mode: 'development' },
      configFile,
      tempDir,
      undefined,
      undefined,
      'runner',
      undefined,
    )
  })
})
