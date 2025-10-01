export type GenerateType = 'app' | 'page' | 'component'

export type JsonExt = 'json' | 'js' | 'ts' | (string & {})

export interface GenerateJsonOptions {
  type?: GenerateType
  ext?: JsonExt
}

export interface GenerateWxmlOptions {
  filepath?: string
}
