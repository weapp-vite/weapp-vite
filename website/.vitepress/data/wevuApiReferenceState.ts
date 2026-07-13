import type { ApiCompatibility, ApiScope } from './wevuApiCatalogTypes'

export interface WevuApiFilterState {
  query: string
  compatibility: 'all' | ApiCompatibility
  scope: 'all' | ApiScope
}

export function resetWevuApiFacets(state: WevuApiFilterState): WevuApiFilterState {
  return {
    query: state.query,
    compatibility: 'all',
    scope: 'all',
  }
}
