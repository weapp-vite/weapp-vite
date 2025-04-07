import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { asset } from './asset'
import { autoImport } from './autoImport'
import { weappVite } from './core'
import { preflight } from './preflight'
import { workers } from './workers'

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  const plugins = [
    ...preflight(ctx),
    ...asset(ctx),
    ...autoImport(ctx),
    ...weappVite(ctx, subPackageMeta),
  ]
  if (subPackageMeta) {
    return plugins
  }
  plugins.push(...workers(ctx))
  return plugins
}
