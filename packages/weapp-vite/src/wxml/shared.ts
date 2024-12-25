export const srcImportTagsMap: Record<string, string[]> = {
  // audio: ['src', 'poster'],
  // video: ['src', 'poster'],
  // image: ['src'],
  // https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/01wxs-module.html
  wxs: ['src'],
  // https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html
  import: ['src'],
  include: ['src'],
}

export interface Token {
  start: number
  end: number
  value: string
}
