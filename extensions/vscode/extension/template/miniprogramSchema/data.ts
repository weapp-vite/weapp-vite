import type { LanguagePlatform } from '@weapp-vite/language-service'
import type { MiniprogramComponentAttribute, MiniprogramComponentEntry, MiniprogramComponentIndexEntry } from './types'
import { getComponentSchema } from '@weapp-vite/language-service'
import miniprogramComponents from '../data/miniprogram-components.json'

const componentEntries = (miniprogramComponents as MiniprogramComponentEntry[]).map((entry) => {
  return {
    ...entry,
    attrsByName: new Map((entry.attrs ?? []).map(attribute => [attribute.name, attribute])),
  } satisfies MiniprogramComponentIndexEntry
})

const componentsByName = new Map(componentEntries.map(entry => [entry.name, entry]))
const platformComponents = new Map<LanguagePlatform, Map<string, MiniprogramComponentIndexEntry>>()

export function getComponents(platform: LanguagePlatform) {
  if (platform === 'weapp') {
    return componentsByName
  }
  const cached = platformComponents.get(platform)
  if (cached) {
    return cached
  }
  const schema = getComponentSchema(platform)
  const entries: MiniprogramComponentIndexEntry[] = schema.components.map((component) => {
    const attrs: MiniprogramComponentAttribute[] = (component.attrs ?? []).map(attribute => ({
      ...attribute,
      type: typeof attribute.type === 'string' ? { name: attribute.type } : attribute.type,
      desc: typeof attribute.desc === 'string' ? [attribute.desc] : attribute.desc,
    }))
    return { ...component, attrs, attrsByName: new Map(attrs.map(attribute => [attribute.name, attribute])) }
  })
  const result = new Map(entries.map(entry => [entry.name, entry]))
  platformComponents.set(platform, result)
  return result
}
