import { describe, expect, it } from 'vitest'
import { createTestCompilerContext, getApp } from './utils'

function collectPluginNames(option: any, bucket: string[] = []): string[] {
  if (!option) {
    return bucket
  }
  if (Array.isArray(option)) {
    option.forEach(item => collectPluginNames(item, bucket))
    return bucket
  }
  if (typeof option === 'object' && option !== null && typeof option.name === 'string') {
    bucket.push(option.name)
  }
  return bucket
}

describe('web integration', () => {
  it('merges web config for demo app', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getApp('weapp-vite-web-demo'),
      isDev: true,
      mode: 'development',
    })

    const webConfig = ctx.configService.weappWebConfig
    expect(webConfig?.enabled).toBe(true)

    const inline = ctx.configService.mergeWeb()
    expect(inline).toBeDefined()

    if (inline) {
      const pluginNames = collectPluginNames(inline.plugins)
      expect(pluginNames).toContain('@weapp-vite/web')
      expect(inline.root).toBe(webConfig?.root)
      expect(inline.build?.outDir).toBe(webConfig?.outDir)
    }

    expect(ctx.webService.isEnabled()).toBe(true)

    await dispose()
  })

  it('skips mergeWeb when web config is disabled', async () => {
    const { ctx, dispose } = await createTestCompilerContext({
      cwd: getApp('weapp-vite-template'),
      isDev: true,
      mode: 'development',
    })

    expect(ctx.configService.weappWebConfig?.enabled).not.toBe(true)
    expect(ctx.configService.mergeWeb()).toBeUndefined()
    expect(ctx.webService.isEnabled()).toBe(false)

    await dispose()
  })
})
