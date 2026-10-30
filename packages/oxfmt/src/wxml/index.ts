import type { FormatConfig } from 'vite-plus/fmt'
import { formatTemplate } from '@weapp-vite/language-service'
import { formatOptions } from '../options'

/** 兼容原有 API：只重排标签，保留文本、表达式、属性原文和内联脚本。 */
export async function formatWxml(source: string, fileName = 'component.wxml', options: FormatConfig = {}): Promise<string> {
  return formatTemplate(source, fileName, { ...formatOptions, ...options })
}
