export interface WxmlFormatterOptions {
  indent: string
  inlineTags?: readonly string[]
  selfClosingTags?: readonly string[]
  wrapAttributes?: number
}

export interface ParsedAttribute {
  text: string
}

export interface TemplateToken {
  attributes?: ParsedAttribute[]
  content: string
  end: number
  matchingIndex?: number
  start: number
  tagName?: string
  type: 'open' | 'close' | 'selfClose' | 'text' | 'opaque'
}

export interface TemplateScanResult {
  safe: boolean
  tokens: TemplateToken[]
}
