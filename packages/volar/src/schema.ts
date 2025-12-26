/**
 * 为小程序配置生成 JSON Schema
 * 为支持 JSON Schema 的编辑器提供验证和自动补全
 *
 * 注意：JSON Schema 定义由 @weapp-core/schematics 统一维护
 * 使用 Zod 定义并自动生成，确保单一数据源
 */
import { JSON_SCHEMA_DEFINITIONS } from '@weapp-core/schematics'

export interface JsonSchema {
  $schema?: string
  $id?: string
  title?: string
  description?: string
  type: string
  properties?: Record<string, any>
  required?: string[]
  additionalProperties?: boolean | any
  items?: any
  definitions?: Record<string, any>
  enum?: string[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
}

/**
 * 根据文件类型获取对应的 JSON Schema
 * Schema 定义来自 @weapp-core/schematics，使用 Zod 维护单一数据源
 */
export function getSchemaForType(type: 'App' | 'Page' | 'Component' | 'Plugin' | 'Sitemap' | 'Theme'): JsonSchema | null {
  const definition = JSON_SCHEMA_DEFINITIONS.find(d => d.typeName === type)
  if (!definition) {
    return null
  }
  return definition.schema as JsonSchema
}

/**
 * 为配置块生成 schema 注释
 */
export function generateSchemaComment(type: 'App' | 'Page' | 'Component' | 'Plugin' | 'Sitemap' | 'Theme'): string {
  const schema = getSchemaForType(type)
  if (!schema) {
    return ''
  }

  return `{
  "$schema": "${schema.$id}",
`
}
