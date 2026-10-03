/** 将原始标签映射到 script setup 可用的原名、camelCase 与 PascalCase 标识符。 */
export function collectComponentTagInfo(tags: Iterable<string>) {
  const componentNames = new Set<string>()
  const tagsByComponentName = new Map<string, Set<string>>()
  for (const tag of tags) {
    const camelName = tag.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase())
    const capitalizedName = camelName ? `${camelName.charAt(0).toUpperCase()}${camelName.slice(1)}` : camelName
    for (const name of [tag, camelName, capitalizedName]) {
      componentNames.add(name)
      const matchedTags = tagsByComponentName.get(name) ?? new Set<string>()
      matchedTags.add(tag)
      tagsByComponentName.set(name, matchedTags)
    }
  }
  return { componentNames, tagsByComponentName }
}
