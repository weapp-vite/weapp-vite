import { createTestCompilerContext, getFixture } from './utils'

describe('build output options', () => {
  const cwd = getFixture('loadDefaultConfig/case0')

  it('keeps build.minify=false when user disables minification', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          minify: false,
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      expect(buildConfig.minify).toBe(false)
    }
    finally {
      await dispose()
    }
  })

  it('keeps build.sourcemap=true when user enables source maps', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          sourcemap: true,
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      expect(buildConfig.sourcemap).toBe(true)
    }
    finally {
      await dispose()
    }
  })
})
