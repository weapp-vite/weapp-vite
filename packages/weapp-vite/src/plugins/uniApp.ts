import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { isUniAppCompatibilityFile, transformUniAppSource } from 'wevu/compiler'

const SUPPORTED_SOURCE_RE = /(?:\.vue|\.[cm]?[jt]sx?|\.(?:css|less|sass|scss|styl|stylus))(?:\?.*)?$/i

function resolveVirtualBlockType(id: string) {
  const queryIndex = id.indexOf('?')
  if (queryIndex < 0) {
    return undefined
  }
  const query = new URLSearchParams(id.slice(queryIndex + 1))
  const sidecar = query.get('weapp-vite-sidecar')
  const block = sidecar ?? (query.has('weapp-vite-vue') ? query.get('type') : undefined)
  return block === 'script' || block === 'template' || block === 'style'
    ? block
    : block
      ? null
      : undefined
}

function resolveIncludedPackage(id: string, include: readonly string[]) {
  const normalized = id.replace(/\\/g, '/')
  return include.find(packageName => normalized.includes(`/node_modules/${packageName}/`))
}

export function uniAppCompatibility(ctx: CompilerContext): Plugin[] {
  const configService = ctx.configService
  const config = configService.weappViteConfig?.uniApp
  if (!config || configService.platform !== 'weapp') {
    return []
  }

  return [{
    name: 'weapp-vite:uni-app-compatibility',
    enforce: 'pre',
    transform(code, id) {
      const blockType = resolveVirtualBlockType(id)
      if (
        id.startsWith('\0')
        || !SUPPORTED_SOURCE_RE.test(id)
        || blockType === null
        || !isUniAppCompatibilityFile(id, configService.absoluteSrcRoot, config.include)
      ) {
        return null
      }
      try {
        const result = transformUniAppSource(code, {
          blockType: blockType ?? undefined,
          filename: id,
          target: 'mp-weixin',
        })
        return result.changed ? { code: result.code, map: null } : null
      }
      catch (error) {
        const packageName = resolveIncludedPackage(id, config.include) ?? '<project-source>'
        const filename = id.split('?', 1)[0]
        const section = blockType ?? (filename.endsWith('.vue') ? 'sfc' : 'source')
        throw new Error(`[uni-app] package=${packageName} file=${filename} block=${section}: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }]
}
