import { getVisitorKeys } from '../../../../../../utils/babel'
import { getRequireImportLiteral } from '../literals'

/** 只排除无需作用域的 AST；任何候选或未知节点仍交给原 Babel 遍历。 */
export function mayNeedScopedLocalRootRewrite(
  ast: unknown,
  mayNeedLiteralRewrite: (importee: string) => boolean,
) {
  try {
    const visitorKeys = getVisitorKeys()
    const pending: any[] = [ast]
    while (pending.length > 0) {
      const node = pending.pop()
      if (!node || typeof node.type !== 'string') {
        return true
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') {
        const importee = getRequireImportLiteral(node.arguments?.[0])
        if (typeof importee === 'string' && (
          importee.includes('miniprogram_npm') || mayNeedLiteralRewrite(importee)
        )) {
          return true
        }
      }

      const keys = visitorKeys[node.type]
      if (!keys) {
        return true
      }
      for (const key of keys) {
        const child = node[key]
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item) {
              pending.push(item)
            }
          }
        }
        else if (child) {
          pending.push(child)
        }
      }
    }
    return false
  }
  catch {
    // 负判定失败不能吞掉原有重写。
    return true
  }
}
