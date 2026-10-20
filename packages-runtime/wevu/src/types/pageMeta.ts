export type PageLayoutMeta = string | false | {
  name: string
  props?: Record<string, unknown>
}

export interface PageMeta {
  layout?: PageLayoutMeta
  [key: string]: unknown
}
