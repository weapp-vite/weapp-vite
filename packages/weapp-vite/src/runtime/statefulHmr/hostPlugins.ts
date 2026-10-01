import type { Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { parseJsLike, traverse } from '../../utils/babel'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { isStatefulHmrBoundary } from './boundaries'
import { createStatefulHmrHostFormatPlugin } from './hostFormat'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'

export function redirectNativeComponentRegistration(code: string): string {
  if (!code.includes('Component')) {
    return code
  }
  const ast = parseJsLike(code)
  const magicString = new MagicString(code)
  let changed = false
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee
      if (
        callee.type !== 'Identifier'
        || callee.name !== 'Component'
        || path.scope.hasBinding('Component')
        || callee.start == null
        || callee.end == null
      ) {
        return
      }
      magicString.overwrite(
        callee.start,
        callee.end,
        `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Component`,
      )
      changed = true
    },
  })
  return changed ? magicString.toString() : code
}

/** 插件先注册，入口身份在快照准备完成后绑定；不在工厂阶段扫描或启动服务。 */
export function createStatefulHmrHostPlugins(ctx: CompilerContext) {
  let entryIds = new Set<string>()
  let delegatedEntryIds = new Set<string>()
  const plugins: Plugin[] = [{
    name: 'weapp-vite:hmr-input',
    enforce: 'pre',
    transform(code, id) {
      if (!entryIds.has(normalizeFsResolvedId(id))) {
        getCompilerHmrHost(ctx).captureNative(id, code)
      }
    },
    watchChange(id, change) {
      if (change.event === 'delete') {
        getCompilerHmrHost(ctx).capture(id, null)
      }
    },
  }, createStatefulHmrSidecarPlugin(), {
    name: 'weapp-vite:stateful-hmr-session',
    enforce: 'post',
    transform(code, id) {
      if (!isStatefulHmrBoundary(id, ctx.configService.absoluteSrcRoot, entryIds, delegatedEntryIds)
        || code.includes('import.meta.hot.accept')) {
        return
      }
      const transformed = id.endsWith('.vue') ? code : redirectNativeComponentRegistration(code)
      return `${transformed}\nif (import.meta.hot) import.meta.hot.accept();\n`
    },
    renderChunk: createStatefulHmrHostFormatPlugin().renderChunk,
  }]
  return {
    plugins,
    setInputs(entries: Set<string>, delegated: Set<string>) {
      entryIds = entries
      delegatedEntryIds = delegated
    },
  }
}

interface StatefulHost {
  server: ViteDevServer
  refreshControl?: () => Promise<void>
  controller: ReturnType<typeof createStatefulHmrHostPlugins>
}
type HostContext = Pick<CompilerContext, 'runtimeState'>
const hosts = new WeakMap<HostContext, StatefulHost>()

/** 借用的服务仍由宿主关闭，会话只拥有自己安装的引擎与通信资源。 */
export function attachStatefulHmrHost(ctx: CompilerContext, host: StatefulHost) {
  if (hosts.has(ctx)) {
    throw new Error('[weapp-vite] stateful 上下文已绑定宿主。')
  }
  hosts.set(ctx, host)
  return () => {
    if (hosts.get(ctx) === host) {
      hosts.delete(ctx)
    }
  }
}

export function getStatefulHmrHost(ctx: HostContext) {
  return hosts.get(ctx)
}
