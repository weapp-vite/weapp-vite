import type { ConfigService } from '../../runtime/config/types'
import { isPathInside } from '../../utils/path'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

type SourceConfig = Pick<ConfigService, 'outDir'>

interface SourceOwner {
  token: symbol
  matches: (file: string) => boolean
}

const scopes = new WeakMap<SourceConfig, Map<string, SourceOwner>>()

/** 编译器声明内容范围，变化仍由既有模块图 watcher 与快照队列交付。 */
export function createCompilerContentSourceOwner(config: SourceConfig) {
  const tokens = new Map<string, symbol>()
  let disposed = false
  const begin = (root: string): symbol | undefined => {
    if (disposed) {
      return undefined
    }
    const token = Symbol('compiler-content-source-root')
    const scope = scopes.get(config) ?? new Map<string, SourceOwner>()
    // 新一代生成尚未完成时保留已发布范围，但接管其生命周期，拒绝旧异步结果回写。
    scope.set(root, { token, matches: scope.get(root)?.matches ?? (() => false) })
    scopes.set(config, scope)
    tokens.set(root, token)
    return token
  }
  const isCurrent = (root: string, token: symbol | undefined) => !disposed && token !== undefined
    && tokens.get(root) === token && scopes.get(config)?.get(root)?.token === token
  const remove = (root: string) => {
    const token = tokens.get(root)
    const scope = scopes.get(config)
    if (token && scope?.get(root)?.token === token) {
      scope.delete(root)
      if (!scope.size) {
        scopes.delete(config)
      }
    }
    tokens.delete(root)
  }
  return {
    begin,
    isCurrent,
    replace(root: string, matches: ((file: string) => boolean) | undefined, generation: symbol | undefined = begin(root)) {
      if (!isCurrent(root, generation)) {
        return
      }
      // 空范围也替换旧归属，不能继续接收已经从 CSS 中撤销的来源。
      scopes.get(config)!.set(root, { token: generation!, matches: matches ?? (() => false) })
    },
    remove,
    dispose() {
      disposed = true
      for (const root of tokens.keys()) {
        remove(root)
      }
    },
  }
}

/** 匹配编译器真实扫描规则，包含尚不存在或刚删除的文件，不推测扩展名或项目。 */
export function ownsCompilerContentSource(config: SourceConfig, file: string) {
  const id = normalizeFsResolvedId(file)
  if (config.outDir && isPathInside(config.outDir, id)) {
    return false
  }
  return [...scopes.get(config)?.values() ?? []].some(owner => owner.matches(id))
}
