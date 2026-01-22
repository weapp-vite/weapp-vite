export const srcImportTagsMap: Record<string, string[]> = {
  // 参考：https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/01wxs-module.html
  wxs: ['src'],
  sjs: ['src'],
  // 参考：https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html
  import: ['src'],
  include: ['src'],
}

export function isImportTag(tagName: string) {
  return ['import', 'include'].includes(tagName)
}

export interface Token {
  start: number
  end: number
  value: string
}
