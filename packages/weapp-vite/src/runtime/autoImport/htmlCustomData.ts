import type { ComponentMetadata } from './metadata'

export function createHtmlCustomDataDefinition(
  componentNames: string[],
  getMetadata: (name: string) => ComponentMetadata,
) {
  const tags = componentNames.map((name) => {
    const metadata = getMetadata(name)
    const combinedTypes = metadata.types
    const docs = metadata.docs
    const attributeNames = new Set<string>([
      ...combinedTypes.keys(),
      ...docs.keys(),
    ])
    const attributes = Array.from(attributeNames)
      .sort((a, b) => a.localeCompare(b))
      .map((propName) => {
        const type = combinedTypes.get(propName)
        const doc = docs.get(propName)
        const pieces: string[] = []
        if (type) {
          pieces.push(`类型: ${type}`)
        }
        if (doc) {
          pieces.push(doc)
        }
        const entry: Record<string, string> = { name: propName }
        if (pieces.length > 0) {
          entry.description = pieces.join('\n')
        }
        return entry
      })
    const tag: Record<string, any> = {
      name,
      description: '自动导入的小程序组件',
    }
    if (attributes.length) {
      tag.attributes = attributes
    }
    tag.references = [
      {
        name: 'weapp-vite 自动导入组件',
        url: 'https://vite.icebreaker.top/guide/auto-import-components.html',
      },
    ]
    return tag
  })

  const payload = {
    version: 1.1,
    tags,
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}
