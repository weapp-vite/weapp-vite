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
  })

  it('exposes compiler context when workers are used', () => {
    const ctx = createCompilerContext('plugin-api:workers')
    const plugins = vitePluginWeappWorkers(ctx)
    const api = extractPluginApi(plugins)
    expect(api?.ctx).toBe(ctx)
  })
})
