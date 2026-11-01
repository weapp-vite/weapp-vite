import type { ScriptExternalUse } from '@weapp-vite/language-service'
import type { ScriptModel } from './model'

/** 导入声明和真实外部使用共用 AST 来源；字符串、注释与遮蔽变量不会落入此入口。 */
export function externalUseAt(model: Pick<ScriptModel, 'analysis' | 'offset'>, offset: number): ScriptExternalUse | undefined {
  const local = offset - model.offset
  const use = model.analysis.externalUses.find(use => use.start <= local && local <= use.end)
  if (use) {
    return use
  }
  const imported = model.analysis.imports.find(imported => (imported.start <= local && local <= imported.end)
    || (imported.importedRange && imported.importedRange.start <= local && local <= imported.importedRange.end))
  return imported ? { source: imported.source, imported: imported.imported, targetScope: imported.targetScope, targetPath: imported.targetPath, localName: imported.localName, start: imported.start, end: imported.end, kind: 'binding', declaration: imported } : undefined
}
