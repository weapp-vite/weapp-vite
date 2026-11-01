export interface WxmlFormatterOptions {
  indent: string
  fileName?: string
  printWidth?: number
  inlineTags?: readonly string[]
  selfClosingTags?: readonly string[]
  wrapAttributes?: number
}
