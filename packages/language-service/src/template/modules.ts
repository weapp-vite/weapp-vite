import type { LanguageProfile } from '../profiles'
import type { Diagnostic } from '../types'
import type { TemplateTag, TemplateToken } from './types'

const scriptTags = new Set(['wxs', 'sjs', 'ks', 'import-sjs', 'filter', 'script'])

/** 原生脚本标签遵循所属平台契约；显式编译脚本交给构建链路处理。 */
export function validateScriptModules(source: string, tokens: TemplateToken[], profile: LanguageProfile): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const modules = new Set<string>()
  const filterSources = new Set<string>()
  const report = (tag: TemplateTag, code: string, message: string) => diagnostics.push({ code: `template/${code}`, severity: 'error', start: tag.start, end: tag.end, message })
  for (const [position, token] of tokens.entries()) {
    if (token.kind !== 'tag' || token.closing || !scriptTags.has(token.name)) {
      continue
    }
    const attribute = (name: string) => token.attributes.find(attribute => attribute.name === name)
    if (/^(?:js|javascript|ts|typescript)$/.test(attribute('lang')?.value ?? '')) {
      continue
    }
    const isFilter = profile.platform === 'swan' && token.name === 'filter'
    if (token.name !== profile.scriptModule.tag && !isFilter) {
      if (attribute('module') || attribute('name') || attribute('src') || attribute('from')) {
        report(token, 'script-platform-mismatch', `${profile.platform} 的原生脚本模块使用 <${profile.scriptModule.tag}>${profile.platform === 'swan' ? ' 或 <filter>' : ''}，当前为 <${token.name}>`)
      }
      continue
    }
    const moduleAttribute = isFilter ? 'module' : profile.scriptModule.moduleAttribute
    const sourceAttribute = isFilter ? 'src' : profile.scriptModule.sourceAttribute
    const moduleName = attribute(moduleAttribute)?.value?.trim()
    if (!moduleName) {
      report(token, 'missing-script-module', `<${token.name}> 需要 ${moduleAttribute} 模块名`)
    }
    else if (modules.has(moduleName)) {
      report(token, 'duplicate-script-module', `脚本模块名 ${moduleName} 在同一模板中不能重复`)
    }
    else {
      modules.add(moduleName)
    }
    const file = attribute(sourceAttribute)?.value
    const body = tokens[position + 1]
    if (file && body?.kind === 'script' && source.slice(body.start, body.end).trim()) {
      report(token, 'script-source-conflict', '外部脚本引用与内联脚本内容不能同时出现')
    }
    if (isFilter && file) {
      if (!/^\.\.?\//.test(file) || !/\.filter\.[jt]s$/.test(file)) {
        report(token, 'invalid-filter-source', '百度 filter 的 src 必须是相对路径；原生使用 .filter.js，编译源码使用 .filter.ts')
      }
      if (filterSources.has(file)) {
        report(token, 'duplicate-filter-source', '同一模板不能重复引入同一个 filter src')
      }
      filterSources.add(file)
    }
  }
  return diagnostics
}
