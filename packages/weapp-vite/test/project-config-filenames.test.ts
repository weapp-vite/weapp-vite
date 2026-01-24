import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getFixture } from './utils'

describe('project config filenames', () => {
  const fixtureRoot = getFixture('project-config-filenames')

  const normalize = (value?: string) => value?.replace(/\\/g, '/')

  it('loads mini.project.json for alipay when multiPlatform is disabled', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: fixtureRoot,
      cliPlatform: 'alipay',
      inlineConfig: {
        weapp: {
          platform: 'alipay',
        },
      },
    })

    try {
      expect(ctx.configService.projectConfig.miniprogramRoot).toBe('dist/mini-root')
      expect(normalize(ctx.configService.projectConfigPath)).toMatch(/mini\.project\.json$/)
      expect(ctx.configService.mpDistRoot).toBe('dist/mini-root')
    }
    finally {
      await dispose()
    }
  })

  it('loads project.swan.json and smartProgramRoot for swan', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: fixtureRoot,
      cliPlatform: 'swan',
      inlineConfig: {
        weapp: {
          platform: 'swan',
        },
      },
    })

    try {
      expect(ctx.configService.projectConfig.smartProgramRoot).toBe('dist/swan-root')
      expect(normalize(ctx.configService.projectConfigPath)).toMatch(/project\.swan\.json$/)
      expect(ctx.configService.mpDistRoot).toBe('dist/swan-root')
    }
    finally {
      await dispose()
    }
  })

  it('loads project.config.json for weapp', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: fixtureRoot,
      cliPlatform: 'weapp',
      inlineConfig: {
        weapp: {
          platform: 'weapp',
        },
      },
    })

    try {
      expect(ctx.configService.projectConfig.miniprogramRoot).toBe('dist/weapp-root')
      expect(normalize(ctx.configService.projectConfigPath)).toMatch(/project\.config\.json$/)
      expect(ctx.configService.mpDistRoot).toBe('dist/weapp-root')
    }
    finally {
      await dispose()
    }
  })
})
