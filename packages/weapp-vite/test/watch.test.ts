import { createCompilerContext } from '@/createContext'

import fs from 'fs-extra'
import path from 'pathe'
// import whyIsNodeRunning from 'why-is-node-running'
import { getFixture, scanFiles } from './utils'

describe('watch', () => {
  it('watch', async () => {
    const cwd = getFixture('watch')
    const distDir = path.resolve(cwd, 'dist')
    await fs.remove(distDir)
    const ctx = await createCompilerContext({
      cwd,
      isDev: true,
      inlineConfig: {
        weapp: {
          debug: {
            watchFiles(watchFiles, meta) {
              if (meta) {
                expect(
                  watchFiles
                    .filter(x => !x.includes('node_modules'))
                    .map((x) => {
                      return ctx.configService.relativeAbsoluteSrcRoot(x)
                    }).sort(),
                ).toMatchSnapshot(`watchFiles-${meta.subPackage.root}`)
              }
              else {
                expect(
                  watchFiles
                    .filter(x => !x.includes('node_modules'))
                    .map((x) => {
                      return ctx.configService.relativeAbsoluteSrcRoot(x)
                    }).sort(),
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

    expect(ctx.scanService.subPackageMetas).toMatchSnapshot()
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/buffer'))).toBe(true)
    expect(await fs.exists(path.resolve(distDir, 'miniprogram_npm/gm-crypto'))).toBe(true)
    // setImmediate(() => whyIsNodeRunning())
    ctx.watcherService.closeAll()
    // setImmediate(() => whyIsNodeRunning())
  })
})
