import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  getProjectConfig,
  getProjectConfigFileName,
  getProjectConfigRootKeys,
  getProjectPrivateConfigFileName,
  resolveProjectConfigRoot,
  syncProjectConfigToOutput,
} from './projectConfig'

async function createTempDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-project-config-'))
}

describe('projectConfig utils', () => {
  it('resolves config file names and root keys by platform', () => {
    expect(getProjectConfigFileName('weapp')).toBe('project.config.json')
    expect(getProjectConfigFileName('alipay')).toBe('mini.project.json')
    expect(getProjectPrivateConfigFileName('weapp')).toBe('project.private.config.json')
    expect(getProjectConfigRootKeys('swan')).toContain('smartProgramRoot')
    expect(resolveProjectConfigRoot({
      miniprogramRoot: 'src',
    } as any, 'weapp')).toBe('src')
  })

  it('loads and merges project config with private config', async () => {
    const root = await createTempDir()
    await fs.writeJson(path.join(root, 'project.config.json'), {
      appid: 'wx123',
      miniprogramRoot: 'src',
      mergedFrom: 'base',
    })
    await fs.writeJson(path.join(root, 'project.private.config.json'), {
      projectname: 'demo',
      mergedFrom: 'private',
    })

    const merged = await getProjectConfig(root)
    expect(merged).toMatchObject({
      appid: 'wx123',
      projectname: 'demo',
      mergedFrom: 'base',
    })

    const ignorePrivate = await getProjectConfig(root, { ignorePrivate: true })
    expect(ignorePrivate).toMatchObject({
      appid: 'wx123',
    })
    expect(ignorePrivate).not.toHaveProperty('projectname')
  })

  it('throws on missing/invalid project config and syncs config directory to output', async () => {
    const missingRoot = await createTempDir()
    await expect(getProjectConfig(missingRoot)).rejects.toThrow('找不到项目配置文件')

    const invalidRoot = await createTempDir()
    await fs.writeFile(path.join(invalidRoot, 'project.config.json'), '{invalid', 'utf8')
    await expect(getProjectConfig(invalidRoot)).rejects.toThrow('非法的 json 格式')

    const sourceRoot = await createTempDir()
    const outDir = path.join(sourceRoot, 'dist', 'miniprogram')
    const sourceConfig = path.join(sourceRoot, 'config', 'project.config.json')
    await fs.ensureDir(path.dirname(sourceConfig))
    await fs.writeJson(sourceConfig, { appid: 'wx-sync' })

    await syncProjectConfigToOutput({
      outDir,
      enabled: true,
      projectConfigPath: sourceConfig,
    })
    expect(await fs.pathExists(path.join(sourceRoot, 'dist', 'project.config.json'))).toBe(true)

    await syncProjectConfigToOutput({
      outDir,
      enabled: false,
      projectConfigPath: sourceConfig,
    })
  })
})
