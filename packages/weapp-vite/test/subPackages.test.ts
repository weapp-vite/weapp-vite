import { fs } from '@weapp-core/shared/fs'
import CI from 'ci-info'
import path from 'pathe'
import { cssCodeCache } from '@/plugins/css'
import { wxsCodeCache } from '@/plugins/wxs'
import { ROLLDOWN_RUNTIME_FILE_NAME } from '@/runtime/chunkStrategy/apply/shared/runtime'
import { createBundleRuntime, readBundleOutputs } from './bundleRuntime'
import { createTestCompilerContext, getFixture, scanFiles } from './utils'

async function waitForPathExists(
  targetPath: string,
  options: {
    timeoutMs?: number
    intervalMs?: number
  } = {},
) {
  // 说明：本用例会触发一次完整构建，机器繁忙时文件落盘可能有延迟，给更宽松的默认超时以避免偶发失败。
  const timeoutMs = options.timeoutMs ?? 15000
  const intervalMs = options.intervalMs ?? 50
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(targetPath)) {
      return
    }
    await new Promise<void>(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timed out waiting for path to exist: ${targetPath}`)
}

describe.skipIf(CI.isCI)('subPackages', { concurrent: false }, () => {
  const cwd = getFixture('subPackages')
  const distDir = path.resolve(cwd, 'dist')
  // beforeAll(async () => {
  //   await fs.remove(distDir)
  //   const ctx = await createCompilerContext({
  //     cwd,
  //   })
  //   await ctx.buildService.runProd()
  //   expect(await fs.exists(distDir)).toBe(true)
  // })

  beforeEach(() => {
    wxsCodeCache.clear()
    cssCodeCache.clear()
  })

  it('scanFiles', async () => {
    await fs.remove(distDir)
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })

    try {
      await ctx.buildService.build()

      expect(await fs.exists(distDir)).toBe(true)
      await waitForPathExists(path.resolve(distDir, 'packageB/pages/banana.wxml'))

      const files = await scanFiles(distDir)
      expect(files.filter(file => !file.endsWith('.js'))).toMatchSnapshot()
      const publicEntries = [
        'app.js',
        'components/Navbar/Navbar.js',
        'pages/index/index.js',
        'packageA/index.js',
        'packageA/pages/cat.js',
        'packageA/pages/dog.js',
        'packageB/index.js',
        'packageB/pages/apple.js',
        'packageB/pages/banana.js',
      ]
      expect(wxsCodeCache.size).toBe(0)
      expect(cssCodeCache.size).toBeGreaterThanOrEqual(1)

      expect(ctx.scanService.independentSubPackageMap).toMatchSnapshot()
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/buffer'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'packageB/miniprogram_npm/gm-crypto'))).toBe(false)
      expect(await fs.exists(path.resolve(distDir, 'packageB/pages/banana.js'))).toBe(true)
      expect(await fs.exists(path.resolve(distDir, 'packageB/pages/banana.wxml'))).toBe(true)
      const formatTime = vi.fn((date: Date) => date.toISOString())
      const runtime = createBundleRuntime(await readBundleOutputs(distDir, files), (exports) => {
        if (typeof exports.formatTime !== 'function') {
          return exports
        }
        expect(exports.formatTime(new Date())).toBeUndefined()
        return { ...exports, formatTime }
      })
      // 编译器显式保留主包 runtime，即使本例只有分包消费者；其文件名由源码常量约定。
      runtime.assertDependencyGraph([...publicEntries, ROLLDOWN_RUNTIME_FILE_NAME])
      runtime.load('packageB/pages/banana.js')
      expect(runtime.component).toHaveBeenCalledTimes(1)
      expect(formatTime).toHaveBeenCalledTimes(1)
      expect(Number.isNaN(formatTime.mock.calls[0]![0].getTime())).toBe(false)
      expect(runtime.component).toHaveBeenCalledWith({ data: {
        now: formatTime.mock.results[0]!.value,
        name: 'sub-package-b',
      } })
      expect(runtime.log).toHaveBeenCalledExactlyOnceWith('banana')
    }
    finally {
      await dispose()
    }
  })
})
