import type { ApiEntry } from '../wevuApiCatalog'
import { coreApiDescriptions } from './core'
import { routerApiDescriptions } from './router'
import { storeApiDescriptions } from './store'

const descriptions: Record<ApiEntry, Record<string, string>> = {
  'wevu': coreApiDescriptions,
  'wevu/router': routerApiDescriptions,
  'wevu/store': storeApiDescriptions,
}

export function getWevuApiDescription(entry: ApiEntry, name: string) {
  return descriptions[entry][name] || ''
}
