import type { ComponentAttribute } from '../../src/schema/types.ts'

interface SchemaType {
  kind?: string
  value?: string | number | boolean
  name?: string
  types?: SchemaType[]
  elementType?: SchemaType
}

interface SchemaProperty {
  name: string
  type?: SchemaType
  description?: { zh?: string, en?: string }
  defaultValue?: unknown
}

interface SchemaItem {
  type: string
  name: string
  props?: SchemaProperty[]
  description?: { zh?: string, en?: string }
}

function typeName(type: SchemaType | undefined): string {
  if (!type) {
    return 'unknown'
  }
  if (type.kind === 'literal') {
    return JSON.stringify(type.value)
  }
  if (type.kind === 'union' || type.kind === 'intersection') {
    return (type.types ?? []).map(typeName).join(type.kind === 'union' ? ' | ' : ' & ')
  }
  if (type.kind === 'array') {
    return `Array<${typeName(type.elementType)}>`
  }
  return String(type.value ?? type.name ?? type.kind ?? 'unknown')
}

/** 涂鸦官方组件表是 SchemaDoc 使用的 JSON；只转换 props，不执行其示例或脚本。 */
export function attributesFromTuyaSchema(input: unknown): Map<string, { attrs: ComponentAttribute[], desc?: string[] }> {
  if (!input || typeof input !== 'object' || !('items' in input) || !Array.isArray(input.items)) {
    throw new Error('涂鸦官方 schema 缺少 items')
  }
  const result = new Map<string, { attrs: ComponentAttribute[], desc?: string[] }>()
  for (const item of input.items as SchemaItem[]) {
    if (item.type !== 'component' || typeof item.name !== 'string') {
      continue
    }
    const attrs: ComponentAttribute[] = (item.props ?? []).map((property) => {
      const description = property.description?.zh ?? property.description?.en
      const literals = property.type?.kind === 'union' && property.type.types?.every(type => type.kind === 'literal') ? property.type.types : undefined
      return {
        name: property.name,
        type: { name: typeName(property.type) },
        ...(description ? { desc: [description] } : {}),
        ...(property.defaultValue !== undefined ? { defaultValue: typeof property.defaultValue === 'string' ? property.defaultValue : JSON.stringify(property.defaultValue) } : {}),
        ...(literals ? { enum: literals.map(type => ({ value: String(type.value) })) } : {}),
      }
    })
    const description = item.description?.zh ?? item.description?.en
    result.set(item.name, { attrs, ...(description ? { desc: [description] } : {}) })
  }
  return result
}
