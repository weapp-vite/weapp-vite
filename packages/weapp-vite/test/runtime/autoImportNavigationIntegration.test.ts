import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from '../utils'

describe('autoImportComponents navigation integration', () => {
  const fixtureSource = getFixture('auto-import')
  const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
  let tempDir = ''
  let ctx: Awaited<ReturnType<typeof createTestCompilerContext>>['ctx']
  let disposeCtx: (() => Promise<void>) | undefined
  let helloWorldTemplate = ''
  let componentsDefinitionPath = ''

  beforeAll(async () => {
    await fs.ensureDir(tempRoot)
    tempDir = await fs.mkdtemp(path.join(tempRoot, 'auto-import-nav-'))
    await fs.copy(fixtureSource, tempDir, { dereference: true })

    const configPath = path.resolve(tempDir, 'vite.config.ts')
    const original = await fs.readFile(configPath, 'utf8')
    const normalized = original.replace(/\r\n/g, '\n')
    const hasCrLf = original.includes('\r\n')
    const before = `autoImportComponents: {\n        globs: ['components/**/*'],\n        resolvers: [\n          VantResolver()\n        ]\n      }`
    const after = `autoImportComponents: {\n        globs: ['components/**/*'],\n        vueComponents: true,\n        resolvers: [\n          VantResolver(),\n          { components: { 'mock-empty': 'mock-ui/empty/empty' } },\n        ]\n      }`
    if (!normalized.includes(before)) {
      throw new Error('无法更新测试配置：autoImportComponents 片段未找到')
    }
    const updated = normalized.replace(before, after)
    const finalContent = hasCrLf ? updated.replace(/\n/g, '\r\n') : updated
    await fs.writeFile(configPath, finalContent, 'utf8')

    const packageRoot = path.resolve(tempDir, 'node_modules/mock-ui')
    const emptyDts = path.resolve(packageRoot, 'miniprogram_dist/empty/empty.d.ts')
    await fs.ensureDir(path.dirname(emptyDts))
    await fs.writeJson(path.resolve(packageRoot, 'package.json'), {
      name: 'mock-ui',
      version: '0.0.0',
      miniprogram: 'miniprogram_dist',
    }, { spaces: 2 })
    await fs.writeFile(emptyDts, 'export {}', 'utf8')

    helloWorldTemplate = path.resolve(tempDir, 'src/components/HelloWorld/index.wxml')
    componentsDefinitionPath = path.resolve(tempDir, 'components.d.ts')

    const result = await createTestCompilerContext({ cwd: tempDir })
    ctx = result.ctx
    disposeCtx = result.dispose
  })

  afterAll(async () => {
    await disposeCtx?.()
    if (tempDir) {
      await fs.remove(tempDir)
      if (await fs.pathExists(tempRoot)) {
        const remaining = await fs.readdir(tempRoot)
        if (remaining.length === 0) {
          await fs.remove(tempRoot)
        }
      }
    }
  })

  it('emits components.d.ts with d.ts-preferred navigation imports', async () => {
    ctx.autoImportService.reset()
    await ctx.autoImportService.awaitManifestWrites()

    await ctx.autoImportService.registerPotentialComponent(helloWorldTemplate)
    await ctx.autoImportService.awaitManifestWrites()

    const content = await fs.readFile(componentsDefinitionPath, 'utf8')
    expect(content).toContain('mock-ui/miniprogram_dist/empty/empty')
    expect(content).not.toContain('mock-ui/miniprogram_dist/empty/empty.js')
  })
})
