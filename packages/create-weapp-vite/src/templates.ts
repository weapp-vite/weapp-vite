import type { TemplateName } from './enums'
import definitions from './templateDefinitions.json'

export interface TemplateDefinition {
  id: TemplateName
  directory: string
  label: string
  visibility: 'default' | 'advanced' | 'experimental'
  framework: 'native' | 'wevu' | 'react'
}

/** 脚手架、发布和 smoke 共用的模板元数据，不因菜单可见性缩减支持范围。 */
export const TEMPLATE_DEFINITIONS = definitions as readonly TemplateDefinition[]

export const TEMPLATE_DIR_MAP = Object.fromEntries(
  TEMPLATE_DEFINITIONS.map(template => [template.id, template.directory]),
) as Record<TemplateName, string>

const definitionsByName = Object.fromEntries(
  TEMPLATE_DEFINITIONS.map(template => [template.id, template]),
) as Record<TemplateName, TemplateDefinition>

/** 按稳定模板标识读取框架及展示配置。 */
export function getTemplateDefinition(templateName: TemplateName): TemplateDefinition {
  return definitionsByName[templateName]
}
