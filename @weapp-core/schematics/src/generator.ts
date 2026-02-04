/**
 * @description 生成模板的目标类型
 */
export type GenerateType = 'app' | 'page' | 'component'

/**
 * @description JSON 输出扩展名
 */
export type JsonExt = 'json' | 'js' | 'ts' | (string & {})

/**
 * @description JSON 模板生成选项
 */
export interface GenerateJsonOptions {
  type?: GenerateType
  ext?: JsonExt
}

/**
 * @description WXML 模板生成选项
 */
export interface GenerateWxmlOptions {
  filepath?: string
}
