import YAML from 'yaml'

/** 使用原 YAML 解析器，并以线性遍历保持默认的映射键判重语义。 */
export function parseLockDocuments(source: string) {
  const documents = YAML.parseAllDocuments(source, { uniqueKeys: false })
  for (const document of documents) {
    YAML.visit(document, {
      Map(_key, map) {
        const keys = new Set<unknown>()
        const values = new Set<unknown>()
        for (const { key } of map.items) {
          let duplicate = keys.has(key)
          keys.add(key)
          if (YAML.isScalar(key)) {
            const value: unknown = key.value
            // Set 使用 SameValueZero，但 YAML 默认使用 ===，不会把两个 NaN 判为重复。
            if (!(typeof value === 'number' && Number.isNaN(value))) {
              duplicate ||= values.has(value)
              values.add(value)
            }
          }
          if (duplicate) {
            const start = YAML.isNode(key) ? key.range?.[0] ?? 0 : 0
            document.errors.push(new YAML.YAMLParseError([start, start + 1], 'DUPLICATE_KEY', 'Map keys must be unique'))
          }
        }
      },
    })
  }
  return documents
}
