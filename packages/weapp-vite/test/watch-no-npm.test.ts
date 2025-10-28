import { sort } from 'fast-sort'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'
import { touch } from '@/utils'
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

describe.skip('watch', () => {
  it('watch-no-npm', async () => {
    const cwd = getFixture('watch-no-npm')
    const distDir = path.resolve(cwd, 'dist')
    await fs.remove(distDir)
    let subWatchFiles: string[] = []
    let rootWatchFiles: string[] = []

    const resolveIdFiles: string[] = []
    const loadFiles: string[] = []
    const subResolveIdFiles: string[] = []
    const subLoadFiles: string[] = []
    // const task = createTask()
    let ctx: Awaited<ReturnType<typeof createCompilerContext>> | undefined

    function resolveAbsPath(files: string[], sorted: boolean = true) {
      const context = ctx
      if (!context) {
        return sorted ? [...files] : [...files]
      }
      const x = files
        .filter(x => path.isAbsolute(x) && !x.includes('node_modules'))
        .map((x) => {
          return context.configService.relativeAbsoluteSrcRoot(x)
        })

      return sorted ? x.sort() : x
    }

    ctx = await createCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        weapp: {
          debug: {
            async watchFiles(watchFiles, meta) {
              if (meta) {
                subWatchFiles = resolveAbsPath(watchFiles)

                expect(
                  subWatchFiles,
                ).toMatchSnapshot(`watchFiles-${meta.subPackage.root}`)
              }
              else {
                rootWatchFiles = resolveAbsPath(watchFiles)
                expect(
                  rootWatchFiles,
                ).toMatchSnapshot('watchFiles')
              }
            },
            resolveId(id, meta) {
              if (meta) {
                subResolveIdFiles.push(id)
              }
              else {
                resolveIdFiles.push(id)
              }
            },
            load(id, meta) {
              if (meta) {
                subLoadFiles.push(id)
              }
              else {
                loadFiles.push(id)
              }
            },
          },
        },
      },
    })
    const context = ctx
    if (!context) {
      throw new Error('compiler context failed to initialize')
    }
    await context.buildService.build()
    expect(await fs.exists(distDir)).toBe(true)
    const files = await scanFiles(distDir)
    expect(files).toMatchSnapshot()

    expect(context.scanService.independentSubPackageMap).toMatchSnapshot()
    // expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    // expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    // expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)

    expect(logger.success).toHaveBeenNthCalledWith(
      1,
      '已清空 dist/ 目录',
    )

    // )

    expect(sort(
      await Promise.all(files.filter(x => x.endsWith('.wxs')).map(async (x) => {
        return {
          file: x,
          code: await fs.readFile(path.resolve(context.configService.outDir, x), 'utf8'),
        }
      })),
    ).by([
      {
        asc: 'file',
      },
    ])).toMatchSnapshot('wxs')

    // expect(resolveAbsPath(resolveIdFiles)).toMatchSnapshot('resolveIdFiles')
    // expect(resolveAbsPath(loadFiles, false)).toMatchSnapshot('loadFiles')

    // expect(resolveAbsPath(subResolveIdFiles)).toMatchSnapshot('subResolveIdFiles')
    expect(rootWatchFiles).toMatchSnapshot('rootWatchFiles 0')
    expect(resolveAbsPath(subLoadFiles, false)).toMatchSnapshot('subLoadFiles')
    loadFiles.length = 0
    subLoadFiles.length = 0
    const appJson = 'app.json.ts'// path.resolve(cwd, 'src/app.json.ts')
    expect(rootWatchFiles.includes(appJson)).toBe(true)
    await touch(path.resolve(cwd, 'src/app.json.ts'))
    expect(resolveAbsPath(loadFiles, false)).toMatchSnapshot('loadFiles hmr')

    // expect(resolveAbsPath(subResolveIdFiles)).toMatchSnapshot('subResolveIdFiles')
    expect(resolveAbsPath(subLoadFiles, false)).toMatchSnapshot('subLoadFiles hmr')
    // expect(logger.success).toHaveBeenNthCalledWith(
    //   6,
    //   '已清空 dist/ 目录',
    // )
    // setImmediate(() => whyIsNodeRunning())
    context.watcherService.closeAll()
    // setImmediate(() => whyIsNodeRunning())
  })
})
