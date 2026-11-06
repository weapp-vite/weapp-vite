import type { Plugin } from 'vite'
import type { CompilerContext, ConfigService } from '../context'
import { isUniAppCompatibilityFile, transformUniAppSource } from 'wevu/compiler'
import { parseSidecarSourceMetadata } from '../moduleGraph/protocol'
import { getHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { bindUniAppCompatibilitySession, cacheUniAppCompatibilitySource } from './uniApp/cache'

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

/** 标记兼容输入准备失败，禁止资产刷新将其降级为历史编译结果。 */
export class UniAppCompatibilityTransformError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause })
    this.name = 'UniAppCompatibilityTransformError'
  }
}

/** 普通 transform 与直接读取源码的编译路径共用同一兼容输入边界。 */
export function transformUniAppCompatibilitySource(
  configService: Pick<ConfigService, 'absoluteSrcRoot' | 'platform' | 'weappViteConfig'>,
  code: string,
  id: string,
  sourceBlockType?: 'script' | 'style' | 'template',
): string {
  const config = configService.weappViteConfig?.uniApp
  if (!config || configService.platform !== 'weapp') {
    return code
  }
  const blockType = sourceBlockType ?? resolveVirtualBlockType(id)
  if (
    id.startsWith('\0')
    || parseSidecarSourceMetadata(id)
    || (!SUPPORTED_SOURCE_RE.test(id) && blockType === undefined)
    || blockType === null
    || !isUniAppCompatibilityFile(id, configService.absoluteSrcRoot, config.include)
  ) {
    return code
  }
  try {
    return cacheUniAppCompatibilitySource(configService, code, id, blockType ?? undefined, () => {
      const result = transformUniAppSource(code, {
        blockType: blockType ?? undefined,
        filename: id,
        target: 'mp-weixin',
      })
      return result.changed ? result.code : code
    })
  }
  catch (error) {
    const packageName = resolveIncludedPackage(id, config.include) ?? '<project-source>'
    const filename = id.split('?', 1)[0]
    const section = blockType ?? (filename.endsWith('.vue') ? 'sfc' : 'source')
    throw new UniAppCompatibilityTransformError(
      `[uni-app] package=${packageName} file=${filename} block=${section}: ${error instanceof Error ? error.message : String(error)}`,
      error,
    )
  }
}

export function uniAppCompatibility(ctx: CompilerContext): Plugin[] {
  const configService = ctx.configService
  if (!configService.weappViteConfig?.uniApp || configService.platform !== 'weapp') {
    return []
  }
  const release = bindUniAppCompatibilitySession(configService, getHmrRuntimeSession(ctx))
  let command: 'build' | 'serve' | undefined

  return [{
    name: 'weapp-vite:uni-app-compatibility',
    enforce: 'pre',
    configResolved(config) {
      command = config.command
    },
    closeBundle() {
      if (!this.meta.watchMode || command === 'serve') {
        release()
      }
    },
    closeWatcher: release,
    transform(code, id) {
      const source = transformUniAppCompatibilitySource(configService, code, id)
      return source === code ? null : { code: source, map: null }
    },
  }]
}
