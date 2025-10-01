import type { GenerateWxmlOptions } from '../generator'

export function generateWxml(options: GenerateWxmlOptions = {}) {
  const { filepath } = options

  return `<view>hello weapp-vite!</view>
${filepath ? `<view>from ${filepath}</view>` : ''}`
}
