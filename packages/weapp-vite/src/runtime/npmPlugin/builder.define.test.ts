import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'

const viteBuildMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('vite', () => {
  return {
    build: viteBuildMock,
  }
})

describe('runtime npm builder define env', () => {
  it('passes config defineImportMetaEnv into dependency build options', async () => {
    const { createPackageBuilder } = await import('./builder')
    const ctx = {
      configService: {
        cwd: '/project',
        defineImportMetaEnv: {
          'import.meta.env.PLATFORM': JSON.stringify('tt'),
          'import.meta.env': JSON.stringify({
            PLATFORM: 'tt',
            MP_PLATFORM: 'tt',
          }),
        },
        weappViteConfig: {},
      },
    } as MutableCompilerContext

    const builder = createPackageBuilder(ctx)
    await builder.bundleBuild({
      entry: {
        index: '/project/node_modules/wevu/dist/index.mjs',
      },
      name: 'wevu',
      outDir: '/project/dist/miniprogram_npm/wevu',
    })

    expect(viteBuildMock).toHaveBeenCalledTimes(1)
    const buildOptions = viteBuildMock.mock.calls[0]?.[0] as Record<string, any>
    expect(buildOptions.define).toMatchObject({
      'import.meta.env.PLATFORM': JSON.stringify('tt'),
      'process.env.NODE_ENV': JSON.stringify('production'),
    })
  })
})
