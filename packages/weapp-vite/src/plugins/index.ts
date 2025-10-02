import type { Plugin } from 'vite'
import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import { wrapPlugin } from 'vite-plugin-performance'
import { asset } from './asset'
import { autoImport } from './autoImport'
import { weappVite } from './core'
import { css } from './css'
import { preflight } from './preflight'
import { workers } from './workers'
import { wxs } from './wxs'

const RUNTIME_PLUGINS_SYMBOL = Symbol.for('weapp-runtime:plugins')

function includeRuntimePlugins(ctx: CompilerContext, plugins: Plugin[]): Plugin[] {
  const runtimePlugins = (ctx as any)[RUNTIME_PLUGINS_SYMBOL] as Plugin[] | undefined
  if (runtimePlugins?.length) {
    return [...runtimePlugins, ...plugins]
  }
  return plugins
}

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  // 所有
  const basePlugins = [
    ...preflight(ctx),
  ]
  // 主包以及普通子包
  if (!subPackageMeta) {
    basePlugins.push(
      ...asset(ctx),
      ...autoImport(ctx),
    )
  }
  // 所有
  basePlugins.push(
    ...weappVite(ctx, subPackageMeta),
    ...wxs(ctx),
    ...css(ctx),
  )
  // 独立分包
  if (subPackageMeta) {
    return includeRuntimePlugins(ctx, basePlugins)
  }
  // workers 包
  // plugins.push(...workers(ctx))
  const inspectOptions = ctx.configService.weappViteConfig?.debug?.inspect
  const withRuntime = includeRuntimePlugins(ctx, basePlugins)
  return inspectOptions
    // @ts-ignore
    ? wrapPlugin(withRuntime, inspectOptions)
    : withRuntime
}

export function vitePluginWeappWorkers(ctx: CompilerContext) {
  // 所有
  const basePlugins = [
    ...preflight(ctx),
  ]

  // workers 包
  basePlugins.push(...workers(ctx))
  const inspectOptions = ctx.configService.weappViteConfig?.debug?.inspect
  const withRuntime = includeRuntimePlugins(ctx, basePlugins)
  return inspectOptions
  // @ts-ignore
    ? wrapPlugin(withRuntime, inspectOptions)
    : withRuntime
}
