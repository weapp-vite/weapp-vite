import type { GenerateWxmlOptions } from '../generator'

/**
 * @description 生成 WXML 模板
 */
export function generateWxml(options: GenerateWxmlOptions = {}) {
  const { filepath } = options

  return `<view>hello weapp-vite!</view>
${filepath ? `<view>from ${filepath}</view>` : ''}`
}
