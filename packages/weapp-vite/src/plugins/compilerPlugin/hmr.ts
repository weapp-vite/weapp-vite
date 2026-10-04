import type { CompilerContext } from '../../context'
import path from 'node:path'
import { HmrCompilerHost } from '@weapp-vite/hmr'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import { resolveRealpath } from '../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export { CompilerHmrResyncError } from '@weapp-vite/hmr'

const hosts = new WeakMap<CompilerContext, CompilerHmrHost>()
const hostsByConfig = new WeakMap<object, CompilerHmrHost>()

/** 统一扫描器与模块图中的符号链接身份，删除事件沿用父目录的真实路径。 */
export function compilerSourceId(id: string): string {
  if (!path.isAbsolute(id) && path.win32.isAbsolute(id)) {
    return normalizeFsResolvedId(id)
  }
  try {
    return normalizeFsResolvedId(resolveRealpath(id))
  }
  catch {
    try {
      return normalizeFsResolvedId(path.join(resolveRealpath(path.dirname(id)), path.basename(id)))
    }
    catch {
      return normalizeFsResolvedId(id)
    }
  }
}

export class CompilerHmrHost extends HmrCompilerHost {
  constructor() {
    super({
      sourceId: compilerSourceId,
      hasVisualChange(file, previous, current) {
        if (!file.endsWith('.vue')) {
          return /\.(?:jsx|tsx|wxml|wxss|css)$/.test(file)
        }
        if (typeof previous !== 'string' || typeof current !== 'string') {
          return true
        }
        const before = resolveVueSfcHmrSignatures(previous, file).blockSignatures
        const after = resolveVueSfcHmrSignatures(current, file).blockSignatures
        return !before || !after || before.template !== after.template || before.style !== after.style || before.config !== after.config
      },
    })
  }
}

export function getCompilerHmrHost(ctx: CompilerContext): CompilerHmrHost {
  let host = hosts.get(ctx)
  if (!host) {
    host = new CompilerHmrHost()
    hosts.set(ctx, host)
    if (ctx.configService) {
      hostsByConfig.set(ctx.configService, host)
    }
  }
  return host
}

export function getCompilerHmrHostByConfig(config: object): CompilerHmrHost | undefined {
  return hostsByConfig.get(config)
}
