import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizePath } from '../../../../utils/path'
import {
  formatProjectConfigPath,
  loadPackageJson,
  normalizeRelativeDistRoot,
  pluginMatchesName,
  resolveMultiPlatformConfig,
  resolveProjectConfigPaths,
} from './shared'

describe('loadConfig shared', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
  })

  it('matches plugin names across nested plugin arrays', () => {
    expect(pluginMatchesName({ name: 'target' } as any, 'target')).toBe(true)
    expect(pluginMatchesName([{ name: 'other' }, [{ name: 'target' }]] as any, 'target')).toBe(true)
    expect(pluginMatchesName({ name: 'other' } as any, 'target')).toBe(false)
  })

  it('resolves multi-platform config defaults and object overrides', () => {
    expect(resolveMultiPlatformConfig(undefined)).toEqual({
      enabled: false,
      projectConfigRoot: 'config',
    })
    expect(resolveMultiPlatformConfig(true)).toEqual({
      enabled: true,
      projectConfigRoot: 'config',
    })
    expect(resolveMultiPlatformConfig({
      enabled: false,
      projectConfigRoot: ' custom-root ',
    })).toEqual({
      enabled: false,
      projectConfigRoot: 'custom-root',
    })
  })

  it('resolves project config paths for explicit, default and multi-platform modes', () => {
    expect(resolveProjectConfigPaths({
      platform: 'weapp',
      multiPlatform: { enabled: false, projectConfigRoot: 'config' },
      projectConfigPath: 'custom/project.config.json',
      isWebRuntime: false,
    })).toEqual({
      basePath: 'custom/project.config.json',
      privatePath: 'custom/project.private.config.weapp.json',
    })

    expect(resolveProjectConfigPaths({
      platform: 'weapp',
      multiPlatform: { enabled: false, projectConfigRoot: 'config' },
      isWebRuntime: false,
    })).toEqual({
      basePath: 'project.config.json',
      privatePath: 'project.private.config.json',
    })

    expect(resolveProjectConfigPaths({
      platform: 'alipay',
      multiPlatform: { enabled: true, projectConfigRoot: 'configs' },
      isWebRuntime: false,
    })).toEqual({
      basePath: 'configs/alipay/mini.project.json',
      privatePath: 'configs/alipay/project.private.config.json',
    })

    expect(resolveProjectConfigPaths({
      platform: 'weapp',
      multiPlatform: { enabled: true, projectConfigRoot: 'config' },
      isWebRuntime: true,
    })).toEqual({})
  })

  it('formats project config paths relative to cwd when possible', () => {
    expect(formatProjectConfigPath('/project', 'config/wechat/project.config.json')).toBe('config/wechat/project.config.json')
    expect(formatProjectConfigPath('/project', '../shared/project.config.json')).toBe('/shared/project.config.json')
    expect(formatProjectConfigPath('/project')).toBe('project.config.json')
  })

  it('normalizes relative dist roots to posix style without leading dot segments', () => {
    expect(normalizeRelativeDistRoot('./dist/wechat/')).toBe('dist/wechat')
    expect(normalizeRelativeDistRoot('dist\\alipay\\\\')).toBe('dist/alipay')
  })

  it('loads package.json when present and falls back to an empty object', async () => {
    const existingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-config-shared-'))
    tempRoots.push(existingRoot)
    await fs.writeFile(path.join(existingRoot, 'package.json'), JSON.stringify({
      name: 'weapp-vite',
      private: true,
    }), 'utf8')

    await expect(loadPackageJson(existingRoot)).resolves.toEqual({
      packageJson: { name: 'weapp-vite', private: true },
      packageJsonPath: normalizePath(path.join(existingRoot, 'package.json')),
    })

    const missingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-load-config-shared-'))
    tempRoots.push(missingRoot)

    await expect(loadPackageJson(missingRoot)).resolves.toEqual({
      packageJson: {},
      packageJsonPath: normalizePath(path.join(missingRoot, 'package.json')),
    })
  })
})
