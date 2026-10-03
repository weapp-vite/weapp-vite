import type { BuiltinPackageAliasEntry, ResolveBuiltinPackageAliasesOptions } from '../../packageAliases'
import { resolveBuiltinPackageAliases } from '../../packageAliases'

/** 配置加载拥有解析结果；重新加载时清空，避免跨项目或依赖安装保留旧结果。 */
export function createBuiltinAliasResolver() {
  const resolved = new Map<string, BuiltinPackageAliasEntry[]>()
  return {
    resolve(options: ResolveBuiltinPackageAliasesOptions = {}) {
      const key = JSON.stringify([options.cwd, options.isDev, options.wevuRuntime])
      let aliases = resolved.get(key)
      if (!aliases) {
        aliases = resolveBuiltinPackageAliases(options)
        resolved.set(key, aliases)
      }
      return aliases
    },
    clear() {
      resolved.clear()
    },
  }
}
