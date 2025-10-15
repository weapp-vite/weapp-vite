import { createTestCompilerContext, getFixture } from './utils'

function getPluginNames(plugins: any) {
  const pluginArray = plugins == null
    ? []
    : Array.isArray(plugins)
      ? plugins
      : [plugins]
  return pluginArray.map((plugin: any) => plugin?.name)
}

describe('weapp.jsFormat & legacy targets', () => {
  const cwd = getFixture('loadDefaultConfig/case0')

  it('defaults to cjs output without legacy transform', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      const rolldownOutput = buildConfig.rolldownOptions?.output

      expect(ctx.configService.weappViteConfig.jsFormat).toBe('cjs')
      expect(buildConfig.target).toBeUndefined()
      expect(Array.isArray(rolldownOutput)).toBe(false)
      if (!Array.isArray(rolldownOutput) && rolldownOutput) {
        expect(rolldownOutput).toMatchObject({
          format: 'cjs',
        })
      }
      else {
        throw new Error('expected a single rolldown output object')
      }

      const pluginNames = getPluginNames(buildConfig.rolldownOptions?.plugins)
      expect(pluginNames).not.toContain('weapp-runtime:swc-es5-transform')
    }
    finally {
      await dispose()
    }
  })

  it('switches to esm output when configured', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          jsFormat: 'esm',
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      const rolldownOutput = buildConfig.rolldownOptions?.output

      expect(ctx.configService.weappViteConfig.jsFormat).toBe('esm')
      if (!Array.isArray(rolldownOutput) && rolldownOutput) {
        expect(rolldownOutput).toMatchObject({
          format: 'esm',
        })
      }
      else {
        throw new Error('expected a single rolldown output object')
      }

      const pluginNames = getPluginNames(buildConfig.rolldownOptions?.plugins)
      expect(pluginNames).not.toContain('weapp-runtime:swc-es5-transform')
    }
    finally {
      await dispose()
    }
  })

  it('normalises shorthand ES targets to modern equivalents', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          target: 'es6',
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      expect(buildConfig.target).toBe('es2015')
    }
    finally {
      await dispose()
    }
  })

  it('keeps user specified modern targets untouched', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        build: {
          target: 'firefox60',
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      expect(buildConfig.target).toBe('firefox60')
    }
    finally {
      await dispose()
    }
  })

  it('applies format override to custom rolldown output arrays', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          jsFormat: 'esm',
        },
        build: {
          rolldownOptions: {
            output: [
              {
                entryFileNames: 'custom/[name].js',
              },
            ],
          },
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      const rolldownOutput = buildConfig.rolldownOptions?.output

      expect(Array.isArray(rolldownOutput)).toBe(true)
      expect(rolldownOutput).toEqual([
        expect.objectContaining({
          entryFileNames: 'custom/[name].js',
          format: 'esm',
        }),
      ])
    }
    finally {
      await dispose()
    }
  })

  it('throws when build.target is below ES2015 without es5 opt-in', async () => {
    await expect(async () => {
      await createTestCompilerContext({
        cwd,
        inlineConfig: {
          build: {
            target: 'es5',
          },
        },
      })
    }).rejects.toThrow(/ES2015/)
  })

  it('enables swc-based es5 transform when requested', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          es5: true,
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      const pluginNames = getPluginNames(buildConfig.rolldownOptions?.plugins)

      expect(ctx.configService.weappViteConfig.es5).toBe(true)
      expect(buildConfig.target).toBe('es2015')
      expect(pluginNames).toContain('weapp-runtime:swc-es5-transform')
    }
    finally {
      await dispose()
    }
  })

  it('normalises es5 target when legacy option is enabled', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd,
      inlineConfig: {
        weapp: {
          es5: true,
        },
        build: {
          target: 'es5',
        },
      },
    })

    try {
      const buildConfig = ctx.configService.options.config.build!
      expect(buildConfig.target).toBe('es2015')
    }
    finally {
      await dispose()
    }
  })

  it('rejects enabling es5 when output format is esm', async () => {
    await expect(async () => {
      await createTestCompilerContext({
        cwd,
        inlineConfig: {
          weapp: {
            jsFormat: 'esm',
            es5: true,
          },
        },
      })
    }).rejects.toThrow(/weapp\.es5/)
  })
})
