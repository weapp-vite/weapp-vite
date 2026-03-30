import * as fs from 'node:fs/promises'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'
import { syncProjectSupportFiles } from '../../src/runtime/supportFiles'
import { createTestCompilerContext, getFixture } from '../utils'

const fixtureSource = getFixture('auto-import')

async function createTempProject() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-support-files-'))
  await fs.cp(fixtureSource, cwd, {
    dereference: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(fixtureSource, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !(relative === 'dist' || relative.startsWith('dist/'))
    },
  })
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
  return cwd
}

describe('support files integration', () => {
  let cwd: string
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    cwd = await createTempProject()
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    warnSpy.mockRestore()
    if (cwd) {
      await fs.rm(cwd, { recursive: true, force: true })
    }
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

    try {
      await fs.rm(manifestPath, { force: true })
      await fs.rm(managedTsconfigPath, { force: true })
      ctx.autoImportService.reset()
      warnSpy.mockClear()

      const result = await syncProjectSupportFiles(ctx)
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      const tsconfig = JSON.parse(await fs.readFile(managedTsconfigPath, 'utf8'))

      expect(result.managedTsconfigChanged).toBe(true)
      expect(manifest.HelloWorld).toBe('/components/HelloWorld/index')
      expect(manifest['van-button']).toBe('@vant/weapp/button')
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
})
