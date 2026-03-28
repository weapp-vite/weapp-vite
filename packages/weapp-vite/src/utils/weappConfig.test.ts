import os from 'node:os'
/* eslint-disable e18e/ban-dependencies -- tests reuse fs-extra helpers to mirror module behavior. */
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  isWeappConfigBasename,
  resolveSpecifiedWeappConfigPath,
  resolveWeappConfigFile,
  WEAPP_VITE_CONFIG_CANDIDATES,
} from './weappConfig'

async function createTempDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-config-'))
}

describe('resolveWeappConfigFile', () => {
  it('resolves specified config paths and detects supported config basenames', () => {
    expect(resolveSpecifiedWeappConfigPath('/project', './config/weapp-vite.config.ts')).toBe('/project/config/weapp-vite.config.ts')
    expect(resolveSpecifiedWeappConfigPath('/project', '/tmp/weapp-vite.config.ts')).toBe('/tmp/weapp-vite.config.ts')
    expect(isWeappConfigBasename('/project/weapp-vite.config.ts')).toBe(true)
    expect(isWeappConfigBasename('/project/vite.config.ts')).toBe(false)
  })

  it('resolves specified config path when file exists', async () => {
    const root = await createTempDir()
    const configFile = path.join(root, 'weapp-vite.config.ts')
    await fs.writeFile(configFile, 'export default {}', 'utf8')

    const resolved = await resolveWeappConfigFile({
      root,
      specified: './weapp-vite.config.ts',
    })
    expect(resolved).toBe(configFile)
  })

  it('falls back to config lookup in specified directory and root directory', async () => {
    const root = await createTempDir()
    const subDir = path.join(root, 'sub')
    await fs.ensureDir(subDir)
    const subConfig = path.join(subDir, 'weapp-vite.config.mjs')
    const rootConfig = path.join(root, 'weapp-vite.config.js')

    await fs.writeFile(subConfig, 'export default {}', 'utf8')
    await fs.writeFile(rootConfig, 'module.exports = {}', 'utf8')

    const fromSpecifiedDir = await resolveWeappConfigFile({
      root,
      specified: path.join(subDir, 'entry.ts'),
    })
    expect(fromSpecifiedDir).toBe(subConfig)

    await fs.remove(subConfig)
    const fromRoot = await resolveWeappConfigFile({ root })
    expect(fromRoot).toBe(rootConfig)
  })

  it('exports full config candidate list', () => {
    expect(WEAPP_VITE_CONFIG_CANDIDATES).toContain('weapp-vite.config.ts')
    expect(WEAPP_VITE_CONFIG_CANDIDATES.length).toBeGreaterThan(1)
  })
})
