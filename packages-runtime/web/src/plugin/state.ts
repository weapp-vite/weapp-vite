import type { ScanState } from './types'

export function createEmptyScanState(): ScanState {
  return {
    moduleMeta: new Map(),
    pageNavigationMap: new Map(),
    templateComponentMap: new Map(),
    templatePathSet: new Set(),
    componentTagMap: new Map(),
    componentIdMap: new Map(),
    appNavigationDefaults: {},
    appComponentTags: {},
    scanResult: {
      app: undefined,
      pages: [],
      components: [],
    },
  }
}
