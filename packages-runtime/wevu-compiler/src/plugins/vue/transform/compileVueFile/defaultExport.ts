import type { NativeCompilerScriptAnalysis } from '@weapp-vite/ast'
import { parseJsLike, traverse } from '../../../../utils/babel'

const EXPORT_DEFAULT_RE = /\bexport\s+default\b/

/** 文本提示只用于跳过不可能含默认导出的脚本，最终结果仍由 AST 确认。 */
export function mayHaveDefaultExport(scriptCode: string) {
  return EXPORT_DEFAULT_RE.test(scriptCode)
}

/** 复用已经校验的 native 事实；旧 binding 或失败项保持原有 Babel 路径。 */
export function hasDefaultExport(scriptCode: string, nativeAnalysis?: Pick<NativeCompilerScriptAnalysis, 'hasDefaultExport'>) {
  if (!mayHaveDefaultExport(scriptCode)) {
    return false
  }
  if (nativeAnalysis?.hasDefaultExport !== undefined) {
    return nativeAnalysis.hasDefaultExport
  }
  try {
    const ast = parseJsLike(scriptCode)
    let found = false
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        found = true
        path.stop()
      },
    })
    return found
  }
  catch {
    return mayHaveDefaultExport(scriptCode)
  }
}
