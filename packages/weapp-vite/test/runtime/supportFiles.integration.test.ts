import * as fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { syncProjectSupportFiles } from '../../src/runtime/supportFiles'
import { createTempFixtureProject, createTestCompilerContext, getFixture } from '../utils'

const fixtureSource = getFixture('auto-import')

async function createTempProject() {
  const tempProject = await createTempFixtureProject(fixtureSource, 'support-files-integration')
  const cwd = tempProject.tempDir
  const configPath = path.resolve(cwd, 'vite.config.ts')
  const configEntry = pathToFileURL(path.resolve(__dirname, '../../src/config.ts')).href
  const resolverEntry = pathToFileURL(path.resolve(__dirname, '../../src/auto-import-components/resolvers/index.ts')).href
  const configContent = await fs.readFile(configPath, 'utf8')
  const nextContent = configContent
    .replace(/from ['"]weapp-vite['"]/g, `from '${configEntry}'`)
    .replace(/from ['"]weapp-vite\/config['"]/g, `from '${configEntry}'`)
    .replace(/from ['"]weapp-vite\/auto-import-components\/resolvers['"]/g, `from '${resolverEntry}'`)
    .replace(/from ['"]pathe['"]/g, `from 'node:path'`)

  if (nextContent === configContent) {
    throw new Error('Expected weapp-vite imports in fixture vite.config.ts')
  }

  await fs.writeFile(configPath, nextContent, 'utf8')
  return {
    cleanup: tempProject.cleanup,
    cwd,
  }
}

describe('support files integration', () => {
  let cwd: string
  let cleanupTempProject: (() => Promise<void>) | undefined
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    const tempProject = await createTempProject()
    cwd = tempProject.cwd
    cleanupTempProject = tempProject.cleanup
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    warnSpy.mockRestore()
    await cleanupTempProject?.()
    cleanupTempProject = undefined
  })

  it('auto-syncs stale managed tsconfig during context creation', async () => {
    const first = await createTestCompilerContext({ cwd })
    const managedTsconfigPath = path.resolve(cwd, '.weapp-vite/tsconfig.app.json')
    const freshContent = await fs.readFile(managedTsconfigPath, 'utf8')

    await first.dispose()

    await fs.writeFile(managedTsconfigPath, '{"compilerOptions":{"paths":{"broken":["./broken/*"]}}}\n', 'utf8')
    warnSpy.mockClear()

    const second = await createTestCompilerContext({ cwd })

    try {
      const repairedContent = await fs.readFile(managedTsconfigPath, 'utf8')
      const repairedConfig = JSON.parse(await fs.readFile(managedTsconfigPath, 'utf8'))

      expect(repairedContent).toBe(freshContent)
      expect(repairedConfig.compilerOptions.paths).toMatchObject({
        '@/*': ['../src/*'],
      })
      expect(warnSpy).toHaveBeenCalledWith(
        '[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 weapp-vite prepare 并提交更新。',
      )
    }
    finally {
      await second.dispose()
    }
  })

  it('syncProjectSupportFiles regenerates auto-import outputs for a real project', async () => {
    const { ctx, dispose } = await createTestCompilerContext({ cwd })
    const manifestPath = path.resolve(cwd, '.weapp-vite/auto-import-components.json')
    const managedTsconfigPath = path.resolve(cwd, '.weapp-vite/tsconfig.app.json')
    const typedDefinitionPath = path.resolve(cwd, '.weapp-vite/typed-components.d.ts')
    const vueComponentsPath = path.resolve(cwd, '.weapp-vite/components.d.ts')

    try {
      await fs.rm(manifestPath, { force: true })
      await fs.rm(managedTsconfigPath, { force: true })
      await fs.rm(typedDefinitionPath, { force: true })
      await fs.rm(vueComponentsPath, { force: true })
      ctx.autoImportService.reset()
      warnSpy.mockClear()

      const result = await syncProjectSupportFiles(ctx)
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      const tsconfig = JSON.parse(await fs.readFile(managedTsconfigPath, 'utf8'))
      const typedDefinition = await fs.readFile(typedDefinitionPath, 'utf8')
      const vueComponentsDefinition = await fs.readFile(vueComponentsPath, 'utf8')

      expect(result.managedTsconfigChanged).toBe(true)
      expect(manifest.HelloWorld).toBe('/components/HelloWorld/index')
      expect(manifest['van-button']).toBe('@vant/weapp/button')
      expect(manifest['van-action-sheet']).toBe('@vant/weapp/action-sheet')
      expect(typedDefinition).toContain('\'van-action-sheet\': {')
      expect(typedDefinition).toContain('readonly show?: boolean;')
      expect(vueComponentsDefinition).toContain('VanActionSheet:')
      expect(tsconfig.compilerOptions.paths).toMatchObject({
        '@/*': ['../src/*'],
      })
      expect(
        warnSpy.mock.calls.some(([message]) => String(message).includes('[prepare]')),
      ).toBe(false)
    }
    finally {
      await dispose()
    }
  })

  it('supports projects that only keep weapp-vite.config.ts', async () => {
    const viteConfigPath = path.resolve(cwd, 'vite.config.ts')
    const weappConfigPath = path.resolve(cwd, 'weapp-vite.config.ts')
    await fs.rename(viteConfigPath, weappConfigPath)

    const { ctx, dispose } = await createTestCompilerContext({ cwd })
    const managedNodeTsconfigPath = path.resolve(cwd, '.weapp-vite/tsconfig.node.json')

    try {
      const nodeTsconfig = JSON.parse(await fs.readFile(managedNodeTsconfigPath, 'utf8'))

      expect(ctx.configService.configFilePath?.endsWith('weapp-vite.config.ts')).toBe(true)
      expect(nodeTsconfig.include).toContain('../weapp-vite.config.ts')
    }
    finally {
      await dispose()
    }
  })
})
