export type LegacyTemplateScope = Record<string, any>
export type LegacyTemplateRenderer = (scope?: LegacyTemplateScope) => string

export interface RenderOptions {
  skipFor?: boolean
  overrideAttribs?: Record<string, string>
}

export interface ExtractForResult {
  expr?: string
  itemName: string
  indexName: string
  restAttribs: Record<string, string>
}
