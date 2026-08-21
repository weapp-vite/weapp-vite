import {
  WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_VIRTUAL_ID,
} from '@weapp-core/constants'
import { compileVueFile } from '@wevu/compiler'

const RUNTIME_ALIASES: Record<string, string> = {
  [WEAPP_VITE_RUNTIME_VIRTUAL_ID]: 'wevu/internal-runtime',
  [WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID]: 'wevu/internal-reactivity',
  [WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID]: 'wevu/internal-template',
}

export interface WevuSfcPlugin {
  name: string
  enforce: 'pre'
  resolveId: (this: { resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null> }, source: string, importer?: string) => string | undefined | Promise<string | undefined>
  transform: (code: string, id: string) => undefined | { code: string, map: any } | Promise<undefined | { code: string, map: any }>
}

export interface WevuSfcOptions {
  isPage?: (filename: string) => boolean | Promise<boolean>
}

function isVueFile(id: string) {
  return /\.vue(?:$|\?)/.test(id)
}

function normalizeFilename(id: string) {
  return id.split('?')[0].replaceAll('\\', '/')
}

function isAppFile(filename: string) {
  return /(?:^|\/)app\.vue$/.test(filename)
}

function isLikelyPageFile(filename: string) {
  return /(?:^|\/)pages?(?:\/|$)/.test(filename)
    && !/(?:^|\/)components?(?:\/|$)/.test(filename)
}

/**
 * 为 Vitest 提供 Wevu SFC 逻辑编译入口。
 *
 * 该插件只输出 SFC script，不加载 Vue Web runtime，也不渲染模板、样式或 WXML。
 */
export function wevuSfc(options: WevuSfcOptions = {}): WevuSfcPlugin {
  return {
    name: 'wevu-test-utils:sfc',
    enforce: 'pre',
    async resolveId(source, importer) {
      const target = RUNTIME_ALIASES[source]
      if (!target) {
        return undefined
      }
      const resolved = await this.resolve(target, importer, { skipSelf: true })
      return resolved?.id ?? target
    },
    async transform(code, id) {
      if (!isVueFile(id)) {
        return undefined
      }
      const filename = normalizeFilename(id)
      const isPage = options.isPage
        ? await options.isPage(filename)
        : isLikelyPageFile(filename)
      if (isAppFile(filename) || isPage) {
        throw new Error(`@wevu/test-utils/vitest 不支持 app.vue 或页面组件：${id}，请改用 @mpcore/test`)
      }
      const result = await compileVueFile(code, filename, {
        skipComponentTransform: true,
        sourceMap: true,
      })
      return {
        code: result.script ?? 'export default {}',
        map: result.scriptMap as any ?? null,
      }
    },
  }
}
