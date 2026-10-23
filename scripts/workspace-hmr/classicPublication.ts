import type { ClassicContentAnalysis } from './classicPublication/analysis'
import type { StatefulHmrControl } from './scenarios'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveMiniProgramComponent } from '../../mpcore/packages/simulator/src/runtime/componentResolution'
import { resolveMiniProgramModule } from '../../mpcore/packages/simulator/src/runtime/moduleResolution'
import { createExtendedLibManager } from '../../packages/weapp-vite/src/plugins/hooks/useLoadEntry/extendedLib'
import { analyzeClassicContent, classicContentKind } from './classicPublication/analysis'
import { snapshotDist } from './output'

function refusedCapturedEndpoint(error: unknown, endpoint: URL): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  if ('errors' in error && Array.isArray(error.errors)) {
    return error.errors.length > 0 && error.errors.every(item => refusedCapturedEndpoint(item, endpoint))
  }
  if ('code' in error) {
    const host = endpoint.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    const addresses = host === 'localhost' ? ['127.0.0.1', '::1', '::ffff:127.0.0.1'] : [host]
    return error.code === 'ECONNREFUSED' && 'address' in error && typeof error.address === 'string'
      && addresses.includes(error.address.toLowerCase()) && 'port' in error
      && error.port === Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80))
  }
  return 'cause' in error && refusedCapturedEndpoint(error.cause, endpoint)
}

/** 旧会话端点必须明确退休；超时、鉴权失败和任意网络错误都不能证明清退。 */
export async function inspectRetiredClassicTransport(control: StatefulHmrControl, signal: AbortSignal, request: typeof fetch = fetch): Promise<'retired-410' | 'connection-refused'> {
  const endpoint = new URL(control.url)
  try {
    const response = await request(control.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'poll', buildId: control.buildId, token: control.token, sessionId: 'classic-publication-inspection', version: 0 }),
      signal,
      redirect: 'error',
    })
    signal.throwIfAborted()
    if (response.status === 410 && !response.redirected) {
      const body = await response.json() as unknown
      signal.throwIfAborted()
      if (!body || typeof body !== 'object' || !('type' in body) || body.type !== 'retired') {
        throw new Error('Classic transition received an invalid retirement response.')
      }
      return 'retired-410'
    }
    throw new Error(`Classic transition retained its old transport (HTTP ${response.status}).`)
  }
  catch (error) {
    signal.throwIfAborted()
    if (refusedCapturedEndpoint(error, endpoint)) {
      return 'connection-refused'
    }
    throw error
  }
}

async function inspectPublication(root: string, platform: 'weapp' | 'alipay', cache: ReadonlyMap<string, ClassicContentAnalysis>, nextCache: Map<string, ClassicContentAnalysis>) {
  const before = await snapshotDist(root)
  const checked = new Set<string>()
  const extensions = platform === 'weapp' ? { template: '.wxml', style: '.wxss', module: '.wxs' } : { template: '.axml', style: '.acss', module: '.sjs' }
  const resolve = (owner: string, target: string) => {
    const resolved = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(owner), target))
    if (resolved === '..' || resolved.startsWith('../')) {
      throw new Error(`Classic publication dependency escapes its output: ${owner}`)
    }
    return resolved
  }
  const hasFile = (absolute: string) => before.has(path.relative(root, absolute).split(path.sep).join('/'))
  const requireFile = (file: string) => {
    if (!before.has(file)) {
      throw new Error(`Classic publication is missing ${file}`)
    }
  }
  const read = async (file: string) => {
    const source = await readFile(path.join(root, file))
    if (createHash('sha256').update(source).digest('hex') !== before.get(file)?.hash) {
      throw new Error('Classic publication changed during its complete output inspection.')
    }
    return source.toString('utf8')
  }
  const requireEntry = (entry: string) => {
    for (const suffix of ['.js', '.json', extensions.template]) {
      requireFile(`${entry}${suffix}`)
    }
  }
  const inspectScript = (file: string, imports: readonly string[]) => {
    for (const target of imports) {
      if (target.startsWith('.') || target.startsWith('/')) {
        resolve(file, target)
      }
      const importer = target.startsWith('/') ? path.join(root, 'app.js') : path.join(root, file)
      const request = target.startsWith('/') ? `.${target}` : target
      if (!resolveMiniProgramModule(importer, request, root, hasFile)) {
        throw new Error(`Classic publication is missing script dependency ${target} from ${file}`)
      }
    }
  }
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Classic publication contains a non-object mini-program configuration.')
    }
    return value as Record<string, unknown>
  }
  requireFile('app.js')
  requireFile('app.json')
  const appSource = await read('app.json')
  const app = record(JSON.parse(appSource) as unknown)
  const extendedLib = createExtendedLibManager()
  extendedLib.syncFromAppJson(app)
  const plugins = record(app.plugins ?? {})
  const inspectComponent = (file: string, target: string) => {
    if (target.startsWith('plugin://')) {
      const alias = target.slice('plugin://'.length).split('/')[0]!
      const declaration = plugins[alias]
      if (declaration && typeof declaration === 'object' && 'provider' in declaration && typeof declaration.provider === 'string' && declaration.provider) {
        return
      }
      throw new Error(`Classic publication has an undeclared plugin component: ${target}`)
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
      throw new Error(`Classic publication has an unsupported component scheme: ${target}`)
    }
    if (!extendedLib.shouldIgnoreEntry(target)) {
      const resolved = resolveMiniProgramComponent(file, target, root, hasFile)
      requireEntry(resolve('app.json', `/${resolved}`))
    }
  }
  const pages = (value: unknown, prefix = '') => {
    if (!Array.isArray(value) || value.some(page => typeof page !== 'string')) {
      throw new Error('Classic publication has no valid app page list.')
    }
    for (const page of value as string[]) {
      requireEntry(path.posix.join(prefix, page))
    }
  }
  pages(app.pages ?? [])
  const subpackages = app.subPackages ?? app.subpackages ?? []
  if (!Array.isArray(subpackages)) {
    throw new TypeError('Classic publication has invalid subpackages.')
  }
  for (const raw of subpackages) {
    const subpackage = record(raw)
    if (typeof subpackage.root !== 'string') {
      throw new TypeError('Classic publication has a subpackage without a root.')
    }
    pages(subpackage.pages, subpackage.root)
  }
  for (const [file, snapshot] of before) {
    if (file.startsWith('__weapp_vite_hmr/')) {
      throw new Error(`Classic publication retained a stateful control file: ${file}`)
    }
    const kind = classicContentKind(file, extensions)
    if (!kind) {
      checked.add(file)
      continue
    }
    const key = `${kind}:${snapshot.hash}`
    const analysis = nextCache.get(key) ?? cache.get(key) ?? analyzeClassicContent(kind, file, file === 'app.json' ? appSource : await read(file))
    nextCache.set(key, analysis)
    if (analysis.kind === 'script') {
      inspectScript(file, analysis.dependencies)
    }
    else if (analysis.kind === 'configuration') {
      for (const target of analysis.dependencies) {
        inspectComponent(file, target)
      }
    }
    else if (analysis.kind === 'template') {
      for (const dependency of analysis.dependencies) {
        const request = dependency.template && !dependency.target.endsWith(extensions.template)
          ? `${dependency.target}${extensions.template}`
          : dependency.target
        requireFile(resolve(file, request))
      }
    }
    else if (analysis.kind === 'style') {
      for (const target of analysis.dependencies) {
        requireFile(resolve(file, target))
      }
    }
    checked.add(file)
  }
  const after = await snapshotDist(root)
  if (after.size !== before.size || [...before].some(([file, value]) => after.get(file)?.hash !== value.hash)) {
    throw new Error('Classic publication changed during its complete output inspection.')
  }
  return { files: [...after].map(([file, value]) => ({ path: file, ...value })), checkedFileCount: checked.size, snapshot: after }
}

/** 一个检查器只属于同一项目的开发会话；缓存不跨会话、项目或平台共享。 */
export function createClassicPublicationInspector(root: string, platform: 'weapp' | 'alipay' = 'weapp') {
  let cache = new Map<string, ClassicContentAnalysis>()
  return async () => {
    const nextCache = new Map<string, ClassicContentAnalysis>()
    const result = await inspectPublication(root, platform, cache, nextCache)
    // 仅保留本轮完整检查使用的内容摘要，删除文件和旧版本不会在会话中累积。
    cache = nextCache
    return result
  }
}

/** 核对整个发布集合及本地依赖闭合，不以修改文件数量限制一次完整模式转换。 */
export async function inspectClassicPublication(root: string, platform: 'weapp' | 'alipay' = 'weapp') {
  return createClassicPublicationInspector(root, platform)()
}
