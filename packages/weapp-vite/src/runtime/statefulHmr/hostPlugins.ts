import type { Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import type { CompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerRawInput } from '../../plugins/compilerPlugin/rawInputs'
import { normalizeAtomicDeleteEvent } from '../../utils/atomicWatchEvent'
import { parseJsLike, traverse } from '../../utils/babel'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { isStatefulHmrBoundary } from './boundaries'
import { createStatefulHmrHostFormatPlugin } from './hostFormat'
import { createStatefulHmrInputTrace } from './inputTrace'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'

function captureKnownRawInput(host: CompilerHmrHost, id: string): void {
  // raw 身份由真实文件读取与编译器依赖登记；module loader 产物不能用文件字节覆盖。
  if (!host.ownsRawSource(id)) {
    return
  }
  try {
    const read = readCompilerRawInput(id)
    host.captureRaw(id, read?.source ?? null, false, read ?? undefined)
  }
  catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      host.captureRaw(id, null, false)
      return
    }
    // Windows 读取目录可报 EPERM；只在读取失败后检查，普通文件不增加 stat 热路径。
    try {
      if (statSync(id).isDirectory()) {
        return
      }
    }
    catch {
      // 核验失败仍保留最初的读取错误，不能覆盖输入捕获失败。
    }
    throw error
  }
}

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
  const inputTrace = createStatefulHmrInputTrace({ root: () => ctx.configService.cwd })
  let entryIds = new Set<string>()
  let delegatedEntryIds = new Set<string>()
  let settlement: (() => Promise<void>) | undefined
  let sidecarInputDrift: { notify: (file: string) => void, releaseTrace?: () => void } | undefined
  const plugins: Plugin[] = [{
    name: 'weapp-vite:stateful-style-client',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      handler(id) {
        if (id.endsWith('/@vite/client')) {
          return '\0/@vite/client'
        }
      },
    },
    load(id) {
      if (id === '\0/@vite/client') {
        // 样式由模板资产管线输出到宿主；不加载 Vite 的浏览器 DOM 样式客户端。
        return 'export function updateStyle() {}\nexport function removeStyle() {}'
      }
    },
  }, {
    name: 'weapp-vite:hmr-input',
    enforce: 'pre',
    transform(code, id) {
      if (id.startsWith('\0') || id.includes('?')) {
        return
      }
      const host = getCompilerHmrHost(ctx)
      const entry = entryIds.has(normalizeFsResolvedId(id))
      inputTrace?.input('transform', id, host, { entry })
      if (!entry && !host.isRawInput(id)) {
        host.captureNative(id, code)
      }
    },
    watchChange: {
      order: 'pre',
      handler(id, change) {
        if (id.startsWith('\0') || id.includes('?')
          || (ctx.configService.outDir && isPathInside(ctx.configService.outDir, id))) {
          return
        }
        const host = getCompilerHmrHost(ctx)
        inputTrace?.input('watch-before', id, host, { event: change.event })
        if (change.event === 'delete') {
          return normalizeAtomicDeleteEvent(id).then((event) => {
            if (event === 'update') {
              captureKnownRawInput(host, id)
            }
            else if (host.ownsRawSource(id)) {
              host.captureRaw(id, null, false)
            }
            else {
              host.capture(id, null)
            }
            inputTrace?.input('watch-after', id, host, { event })
          })
        }
        // 普通 update/create 保持同步捕获，不能让后续消费者先冻结旧输入。
        captureKnownRawInput(host, id)
        inputTrace?.input('watch-after', id, host, { event: change.event })
      },
    },
  }, createStatefulHmrSidecarPlugin(async (file) => {
    const binding = sidecarInputDrift
    const host = getCompilerHmrHost(ctx)
    inputTrace?.input('sidecar-before', file, host, { bound: Boolean(binding) })
    // 没有活动会话或只有 module loader 归属时，保持原读取与输入分类。
    if (!binding || !host.ownsRawSource(file)) {
      return await readFile(file, 'utf8')
    }
    // 同步读取和捕获避免异步旧读取晚于下一次 watch capture 返回，倒退输入账本。
    const previous = host.readSource(file)
    let read: ReturnType<typeof readCompilerRawInput>
    try {
      read = readCompilerRawInput(file)
    }
    catch (error) {
      if (error instanceof CompilerHmrResyncError) {
        inputTrace?.input('sidecar-read-error', file, host, { resync: true })
        binding.notify(file)
      }
      throw error
    }
    const source = read?.source ?? null
    host.captureRaw(file, source, false, read ?? undefined)
    inputTrace?.input('sidecar-after', file, host, { drift: previous !== undefined && previous !== source })
    if (previous !== undefined && previous !== source) {
      // 入口资产可能已经消费旧值；同一 owner 的完整重建负责重新读取和发射。
      binding.notify(file)
    }
    if (!read) {
      throw Object.assign(new Error('Raw sidecar source no longer exists'), { code: 'ENOENT' })
    }
    return read.source
  }), {
    name: 'weapp-vite:stateful-hmr-session',
    enforce: 'post',
    api: {
      whenSettled: () => settlement?.() ?? Promise.reject(new Error('Stateful HMR session is not active')),
    },
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
    bindSidecarInputDrift(notify: (file: string) => void) {
      sidecarInputDrift?.releaseTrace?.()
      const binding = { notify, releaseTrace: inputTrace?.observe(getCompilerHmrHost(ctx)) }
      sidecarInputDrift = binding
      return () => {
        binding.releaseTrace?.()
        if (sidecarInputDrift === binding) {
          sidecarInputDrift = undefined
        }
      }
    },
    bindSettlement(wait: () => Promise<void>) {
      settlement = wait
      return () => {
        if (settlement === wait) {
          settlement = undefined
        }
      }
    },
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
