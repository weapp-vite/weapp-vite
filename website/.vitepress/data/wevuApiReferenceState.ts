import type { ApiCompatibility, ApiScope } from './wevuApiCatalogTypes'

export const DEFAULT_API_COMPATIBILITIES: ApiCompatibility[] = [
  'vue-compatible',
  'vue-compatible-with-notes',
  'vue-different',
  'miniprogram-bridge',
  'wevu-extension',
]

export interface WevuApiFilterState {
  query: string
  compatibilities: ApiCompatibility[]
  scope: 'all' | ApiScope
}

export function resetWevuApiFacets(state: WevuApiFilterState): WevuApiFilterState {
  return {
    query: state.query,
    compatibilities: [...DEFAULT_API_COMPATIBILITIES],
    scope: 'all',
  }
}

export function toggleWevuApiCompatibility(
  selected: ApiCompatibility[],
  value: ApiCompatibility,
): ApiCompatibility[] {
  return selected.includes(value)
    ? selected.filter(item => item !== value)
    : [...selected, value]
}

export function hasDefaultApiCompatibilities(selected: ApiCompatibility[]) {
  return selected.length === DEFAULT_API_COMPATIBILITIES.length
    && DEFAULT_API_COMPATIBILITIES.every(value => selected.includes(value))
}
