import type { Plugin } from 'vite'
import type { WeappVitePluginApi } from '@/types'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompilerContext, resetCompilerContext } from '@/context/getInstance'
import { vitePluginWeapp, vitePluginWeappWorkers, WEAPP_VITE_CONTEXT_PLUGIN_NAME } from './index'

function extractPluginApi(plugins: Plugin<WeappVitePluginApi>[]): WeappVitePluginApi | undefined {
  const plugin = plugins.find(candidate => candidate.name === WEAPP_VITE_CONTEXT_PLUGIN_NAME)
  return plugin?.api as WeappVitePluginApi | undefined
}

describe('vitePluginWeapp plugin api', () => {
  afterEach(() => {
    resetCompilerContext()
  })

  it('exposes compiler context for downstream plugins', () => {
    const ctx = createCompilerContext('plugin-api:app')
    const plugins = vitePluginWeapp(ctx)
    const api = extractPluginApi(plugins)
    expect(api?.ctx).toBe(ctx)
    const names = plugins.map(plugin => plugin.name)
    expect(names).toContain('weapp-vite:runtime-provider:wevu-miniprogram')
    expect(names.indexOf('weapp-vite:runtime-provider:wevu-miniprogram'))
      .toBeLessThan(names.indexOf('weapp-vite:vue:transform'))
  })

  it('selects the native runtime provider when Vue compilation is disabled', () => {
    const ctx = createCompilerContext('plugin-api:native')
    ctx.configService.inlineConfig.weapp = {
      vue: {
        enable: false,
      },
    }

    const names = vitePluginWeapp(ctx).map(plugin => plugin.name)

    expect(names).toContain('weapp-vite:runtime-provider:native-miniprogram')
    expect(names).not.toContain('weapp-vite:runtime-provider:wevu-miniprogram')
    expect(names).not.toContain('weapp-vite:vue:transform')
    expect(names).not.toContain('weapp-vite:wevu:page-features')
  })

  it('exposes compiler context when workers are used', () => {
    const ctx = createCompilerContext('plugin-api:workers')
    const plugins = vitePluginWeappWorkers(ctx)
    const api = extractPluginApi(plugins)
    expect(api?.ctx).toBe(ctx)
  })
})
