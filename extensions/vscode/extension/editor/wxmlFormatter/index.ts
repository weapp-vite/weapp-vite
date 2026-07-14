import type { WxmlFormatterOptions } from './types'
import { printTemplate } from './printer'
import { scanTemplate } from './scanner'

const DEFAULT_WRAP_ATTRIBUTES = 3
const DEFAULT_INLINE_TAGS = ['text', 'icon', 'rich-text']
const DEFAULT_SELF_CLOSING_TAGS = 'image,input,icon,video,audio,camera,live-player,live-pusher,map,canvas,web-view,ad,official-account,open-data'.split(',')

function getLineEnd(text: string) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export function formatWxmlText(text: string, formatterOptions: WxmlFormatterOptions) {
  const lineEnd = getLineEnd(text)
  const source = text.replace(/\r\n?/gu, '\n')
  const scanResult = scanTemplate(source)
  if (!scanResult.safe) {
    return text
  }

  const formattedText = printTemplate(source, scanResult.tokens, {
    indent: formatterOptions.indent,
    inlineTags: formatterOptions.inlineTags ?? DEFAULT_INLINE_TAGS,
    selfClosingTags: formatterOptions.selfClosingTags ?? DEFAULT_SELF_CLOSING_TAGS,
    wrapAttributes: formatterOptions.wrapAttributes ?? DEFAULT_WRAP_ATTRIBUTES,
  })
  if (!formattedText) {
    return text
  }
  return `${formattedText.replace(/\n/gu, lineEnd)}${lineEnd}`
}
