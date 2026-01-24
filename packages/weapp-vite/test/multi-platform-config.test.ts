import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { resetCompilerContext } from '@/context/getInstance'
import { createCompilerContext } from '@/createContext'
import { createTestCompilerContext, getFixture } from './utils'

describe('multiPlatform config', () => {
  const fixtureRoot = getFixture('multi-platform-config')

  it('requires explicit platform when multiPlatform is enabled', async () => {
    const key = 'multi-platform:missing-platform'
    await expect(createCompilerContext({
      cwd: fixtureRoot,
      key,
    })).rejects.toThrow(/multiPlatform/)
    resetCompilerContext(key)
  })

  it('loads platform project config when platform is specified', async () => {
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
      expect(ctx.configService.projectConfig.miniprogramRoot).toBe('dist/mp-weixin')
      expect(ctx.configService.projectConfig.appid).toBe('wx-private')
    }
    finally {
      await dispose()
    }
  })

  it('loads alipay project config file name when platform is specified', async () => {
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
      expect(ctx.configService.projectConfig.miniprogramRoot).toBe('dist/mp-alipay')
      expect(ctx.configService.mpDistRoot).toBe('dist/mp-alipay')
    }
    finally {
      await dispose()
    }
  })

  it('uses smartProgramRoot for swan project config', async () => {
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
      expect(ctx.configService.projectConfig.smartProgramRoot).toBe('dist/mp-swan')
      expect(ctx.configService.mpDistRoot).toBe('dist/mp-swan')
    }
    finally {
      await dispose()
    }
  })

  it('rejects project-config override when multiPlatform is enabled', async () => {
    const key = 'multi-platform:project-config'
    await expect(createCompilerContext({
      cwd: fixtureRoot,
      key,
      cliPlatform: 'weapp',
      projectConfigPath: path.join('config', 'custom.project.config.json'),
    })).rejects.toThrow(/--project-config/)
    resetCompilerContext(key)
  })
})
