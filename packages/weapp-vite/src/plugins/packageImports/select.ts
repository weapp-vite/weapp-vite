import type { PackageJson } from './packageCache'
import { imports as resolvePackageImports } from 'resolve.exports'

interface PackageImportsSelection {
  key: string
  postfix: string
  target?: string
  originalTarget?: string
}

export function packageImportsConditions(conditions: readonly string[], isProduction: boolean, isRequire: boolean) {
  return [
    ...conditions.map(condition => condition === 'development|production' ? isProduction ? 'production' : 'development' : condition),
    isRequire ? 'require' : 'import',
  ]
}

/** 完整的精确键优先于查询后缀；被禁止的精确映射也不能退回较短键。 */
export function selectPackageImportsPostfix(data: PackageJson, id: string, conditions: readonly string[]): PackageImportsSelection | undefined {
  if (!data.imports || typeof data.imports !== 'object' || Array.isArray(data.imports)) {
    return
  }
  let selection: PackageImportsSelection | undefined
  let originalTarget: string | undefined
  for (let index = id.length; index > 0; index = Math.max(id.lastIndexOf('?', index - 1), id.lastIndexOf('#', index - 1))) {
    const key = id.slice(0, index)
    try {
      const mapped = resolvePackageImports(data, key, { conditions, unsafe: true })
      if (mapped !== undefined) {
        if (index === id.length) {
          originalTarget = mapped[0]
        }
        selection = { key, postfix: id.slice(index), target: mapped[0], originalTarget }
        if (Object.hasOwn(data.imports, key)) {
          break
        }
      }
    }
    catch {
      if (Object.hasOwn(data.imports, key)) {
        return
      }
    }
  }
  return selection?.postfix ? selection : undefined
}
