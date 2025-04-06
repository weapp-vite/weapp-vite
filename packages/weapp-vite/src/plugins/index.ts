import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import type { Plugin } from 'vite'
import { preflight } from './preflight'
// import { weappVite } from './weappVite'
import { weappViteNext } from './weappViteNext'
import { workers } from './workers'

// <wxs module="wxs" src="./test.wxs"></wxs>
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

// https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html

// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/fileWatcher.ts#L2
// https://github.com/rollup/rollup/blob/c6751ff66d33bf0f4c87508765abb996f1dd5bbe/src/watch/watch.ts#L174

export function vitePluginWeapp(ctx: CompilerContext, subPackageMeta?: SubPackageMetaValue): Plugin<WeappVitePluginApi>[] {
  return [
    ...preflight(ctx),
    ...weappViteNext(ctx, subPackageMeta),
    ...workers(ctx),
  ]
}
