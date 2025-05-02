import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { wrapPlugin } from 'vite-plugin-performance'
import { asset } from './asset'
import { autoImport } from './autoImport'
import { weappVite } from './core'
import { css } from './css'
import { preflight } from './preflight'
import { workers } from './workers'
import { wxs } from './wxs'

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  // 所有
  const plugins = [
    ...preflight(ctx),
  ]
  // 主包以及普通子包
  if (!subPackageMeta) {
    plugins.push(
      ...asset(ctx),
      ...autoImport(ctx),
    )
  }
  // 所有
  plugins.push(
    ...weappVite(ctx, subPackageMeta),
    ...wxs(ctx),
    ...css(ctx),
  )
  // 独立分包
  if (subPackageMeta) {
    return plugins
  }
  // workers 包
  plugins.push(...workers(ctx))
  const inspectOptions = ctx.configService.weappViteConfig?.debug?.inspect
  return inspectOptions
    ? wrapPlugin(plugins, inspectOptions)
    : plugins
}
