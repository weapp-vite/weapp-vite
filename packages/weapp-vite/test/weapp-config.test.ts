import path from 'pathe'
import { createCompilerContext } from '@/createContext'

const fixtureDir = path.resolve(__dirname, 'fixtures/weapp-config')

describe('weapp-vite config file', () => {
  it('merges weapp-vite.config.ts with vite.config.ts weapp options', async () => {
    const ctx = await createCompilerContext({
      cwd: fixtureDir,
      isDev: true,
      mode: 'development',
    })
    const weappConfig = ctx.configService.weappViteConfig

    expect(weappConfig.srcRoot).toBe('src-from-weapp')
    expect(weappConfig.wxml).toBe(false)
    expect(weappConfig.wxs).toBe(false)
    expect(weappConfig.enhance?.wxml).toBe(false)
    expect(weappConfig.enhance?.wxs).toBe(false)
    expect(weappConfig.npm?.enable).toBe(true)
    expect(weappConfig.npm?.cache).toBe(false)

    // config service should resolve src root and config path from weapp-vite.config.ts
    expect(ctx.configService.srcRoot).toBe('src-from-weapp')
    expect(ctx.configService.configFilePath?.endsWith('weapp-vite.config.ts')).toBe(true)
  })
})
