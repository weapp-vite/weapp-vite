import type { WxmlFormatterOptions } from './types'
import { formatTemplate } from '@weapp-vite/language-service'

export function formatWxmlText(text: string, formatterOptions: WxmlFormatterOptions) {
  try {
    return formatTemplate(text, formatterOptions.fileName ?? 'component.wxml', formatterOptions)
  }
  catch {
    // 编辑器不修复结构错误；共享诊断提供准确位置，格式化保持原文。
    return text
  }
}
