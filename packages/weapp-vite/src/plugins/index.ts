import type { Plugin } from 'vite'
import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import { wrapPlugin } from 'vite-plugin-performance'
import { asset } from './asset'
import { autoImport } from './autoImport'
import { autoRoutes } from './autoRoutes'
import { weappVite } from './core'
import { css } from './css'
import { preflight } from './preflight'
import { vue } from './vue'
import { wevu } from './wevu'
import { workers } from './workers'
import { wxs } from './wxs'

const RUNTIME_PLUGINS_SYMBOL = Symbol.for('weapp-runtime:plugins')
export const WEAPP_VITE_CONTEXT_PLUGIN_NAME = 'weapp-vite:context'

function createContextPlugin(ctx: CompilerContext): Plugin<WeappVitePluginApi> {
  return {
    name: WEAPP_VITE_CONTEXT_PLUGIN_NAME,
    enforce: 'pre',
    api: {
      ctx,
    },
  }
}

function attachRuntimePlugins(ctx: CompilerContext, plugins: Plugin[]): Plugin[] {
  const runtimePlugins = (ctx as any)[RUNTIME_PLUGINS_SYMBOL] as Plugin[] | undefined
  if (!runtimePlugins?.length) {
    return plugins
  }

  return [...runtimePlugins, ...plugins]
}

function applyInspect(ctx: CompilerContext, plugins: Plugin[]): Plugin[] {
  const inspectOptions = ctx.configService.weappViteConfig?.debug?.inspect
  if (!inspectOptions) {
    return plugins
  }

  // @ts-ignore 第三方类型未暴露 Plugin[] 的重载
  return wrapPlugin(plugins, inspectOptions)
}

function flatten(groups: Plugin[][]): Plugin[] {
  return groups.reduce<Plugin[]>((acc, cur) => {
    acc.push(...cur)
    return acc
  }, [])
}

export function vitePluginWeapp(
  ctx: CompilerContext,
  subPackageMeta?: SubPackageMetaValue,
): Plugin<WeappVitePluginApi>[] {
  const groups: Plugin[][] = [[createContextPlugin(ctx)], preflight(ctx), wevu(ctx), vue(ctx)]
  const autoRoutesEnabled = ctx.configService?.weappViteConfig?.autoRoutes === true

  if (!subPackageMeta) {
    groups.push(asset(ctx))
    if (autoRoutesEnabled) {
      groups.push(autoRoutes(ctx))
    }
    groups.push(autoImport(ctx))
  }

  groups.push(weappVite(ctx, subPackageMeta), wxs(ctx), css(ctx))

  const assembled = attachRuntimePlugins(ctx, flatten(groups))
  if (subPackageMeta) {
    return assembled
  }

  return applyInspect(ctx, assembled)
}

export function vitePluginWeappWorkers(ctx: CompilerContext): Plugin<WeappVitePluginApi>[] {
  const groups = [[createContextPlugin(ctx)], preflight(ctx), workers(ctx)]
  const assembled = attachRuntimePlugins(ctx, flatten(groups))
  return applyInspect(ctx, assembled)
}
