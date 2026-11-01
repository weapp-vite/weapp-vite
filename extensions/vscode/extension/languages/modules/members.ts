import type { ScriptExportScope, SourceRange } from '@weapp-vite/language-service'
import type { ModuleUse, TemplateModule } from './model'
import { getScriptTemplateExports } from '@weapp-vite/language-service'

export interface ModuleMember extends SourceRange { name: string }

const trivia = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\r\n]*\r?\n)*`
const identifier = String.raw`[$_\p{ID_Start}][$\p{ID_Continue}]*`
const property = new RegExp(String.raw`^${trivia}(?:\.${trivia}(${identifier})|\[${trivia}(['"])(${identifier})\2${trivia}\])`, 'du')

/** 只读取 AST 已确认的模块根后面的静态路径，保留每一级公开成员的原始范围。 */
export function getStaticModuleMembers(source: string, start: number): ModuleMember[] {
  const result: ModuleMember[] = []
  let offset = start
  while (offset < source.length) {
    const match = property.exec(source.slice(offset))
    if (!match) {
      break
    }
    const index = match[1] ? 1 : 3
    const span = match.indices![index]!
    result.push({ name: match[index], start: offset + span[0], end: offset + span[1] })
    offset += match[0].length
  }
  return result
}

export function getModuleExports(module: TemplateModule) {
  return getScriptTemplateExports(module.analysis, module.input).exports
}

export function findModuleExport(module: TemplateModule, path: string[]) {
  return getModuleExports(module).find(item => item.path.length === path.length && item.path.every((name, index) => name === path[index]))
}

/** 模板路径可能继续访问导出值的属性，仅将真正的公开边界计为导出引用。 */
export function getModuleExportRange(use: ModuleUse, name: string, scope: ScriptExportScope) {
  const exported = getModuleExports(use.module).find(item => item.symbol.name === name && item.targetScope === scope && item.path.length > 0
    && item.path.every((part, index) => part === use.members[index]?.name))
  return exported ? use.members[exported.path.length - 1] : undefined
}
