import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { touch } from '@/utils'
import fs from 'fs-extra'
import path from 'pathe'
// import whyIsNodeRunning from 'why-is-node-running'
import { getFixture, scanFiles } from './utils'

vi.mock('@/logger', async (importOriginal) => {
  const mod = await importOriginal()
  // @ts-ignore
  mod.default.success = vi.fn()
  return {
    // @ts-ignore
    ...mod,
  }
})

describe('watch', () => {
  it('watch', async () => {
    const cwd = getFixture('watch')
    const distDir = path.resolve(cwd, 'dist')
    await fs.remove(distDir)
    let subWatchFiles: string[] = []
    let rootWatchFiles: string[] = []
    const ctx = await createCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        weapp: {
          debug: {
            watchFiles(watchFiles, meta) {
              if (meta) {
                subWatchFiles = watchFiles
                  .filter(x => !x.includes('node_modules'))
                  .map((x) => {
                    return ctx.configService.relativeAbsoluteSrcRoot(x)
                  })
                  .sort()
                expect(
                  subWatchFiles,
                ).toMatchSnapshot(`watchFiles-${meta.subPackage.root}`)
              }
              else {
                rootWatchFiles = watchFiles
                  .filter(x => !x.includes('node_modules'))
                  .map((x) => {
                    return ctx.configService.relativeAbsoluteSrcRoot(x)
                  })
                  .sort()
                expect(
                  rootWatchFiles,
                ).toMatchSnapshot('watchFiles')
              }
            },
          },
        },
      },
    })
    await ctx.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()

    expect(ctx.scanService.subPackageMap).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)

    expect(logger.success).toHaveBeenNthCalledWith(
      1,
      '已清空 dist/ 目录',
    )
    // expect(logger.success).toHaveBeenNthCalledWith(
    //   2,
    //   '[npm] `buffer/` 依赖处理完成!',
    // )
    // expect(logger.success).toHaveBeenNthCalledWith(
    //   3,
    //   '[npm] 分包[packageB] `buffer/` 依赖处理完成!',
    // )
    const appJson = 'app.json.ts'// path.resolve(cwd, 'src/app.json.ts')
    expect(rootWatchFiles.includes(appJson)).toBe(true)
    touch(path.resolve(cwd, 'src/app.json.ts'))

    // expect(logger.success).toHaveBeenNthCalledWith(
    //   6,
    //   '已清空 dist/ 目录',
    // )
    // setImmediate(() => whyIsNodeRunning())
    ctx.watcherService.closeAll()
    // setImmediate(() => whyIsNodeRunning())
  })
})
