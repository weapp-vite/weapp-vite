export type ApiCompatibility
  = | 'vue-compatible'
    | 'vue-compatible-with-notes'
    | 'vue-different'
    | 'unsupported'
    | 'miniprogram-bridge'
    | 'wevu-extension'

export type ApiKind
  = | 'global'
    | 'app'
    | 'macro'
    | 'reactivity'
    | 'lifecycle'
    | 'setup'
    | 'options'
    | 'instance'
    | 'directive'
    | 'element'
    | 'tag'
    | 'store'
    | 'runtime'
    | 'type'

export type ApiPhase = 'compile' | 'runtime' | 'type'
export type ApiScope = 'app' | 'page' | 'component'
export type ApiEntry = 'wevu' | 'wevu/router' | 'wevu/store'
export type ApiEntryTab = 'core' | 'router' | 'store'
export type CoreApiCategory
  = | 'all'
    | 'application'
    | 'macros'
    | 'reactivity'
    | 'lifecycle'
    | 'setup'
    | 'options'
    | 'instances'
    | 'directives'
    | 'elements'
    | 'html-tags'
    | 'types'
    | 'runtime'

export interface CoreApiCategoryOption {
  value: CoreApiCategory
  label: string
  group?: string
}

export interface WevuApiItem {
  name: string
  description: string
  href: string
  vueHref?: string
  group: string
  kind: ApiKind
  phase: ApiPhase
  compatibility: ApiCompatibility
  entry: ApiEntry
  scopes?: ApiScope[]
  keywords?: string[]
  transform?: string
}

export interface WevuApiSeed extends Omit<WevuApiItem, 'entry'> {
  entry?: ApiEntry
}
