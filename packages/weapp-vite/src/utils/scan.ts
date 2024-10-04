import { addExtension, removeExtension } from '@weapp-core/shared'
import fs from 'fs-extra'
import { jsExtensions } from '../constants'

// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// app: js + json
// page: wxml + js
// component: wxml + js + json

export function searchPageEntry(wxmlPath: string) {
  if (fs.existsSync(wxmlPath)) {
    const base = removeExtension(wxmlPath)
    for (const ext of jsExtensions) {
      const entryPath = addExtension(base, `.${ext}`)
      if (fs.existsSync(entryPath)) {
        return entryPath
      }
    }
  }
}
// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// wxml + js
export function isPage(wxmlPath: string) {
  return Boolean(searchPageEntry(wxmlPath))
}

export interface SearchAppEntryOptions {
  root: string
  formatPath?: (p: string) => string
}

export function isComponent(wxmlPath: string) {
  if (isPage(wxmlPath)) {
    const jsonPath = addExtension(removeExtension(wxmlPath), '.json')
    if (fs.existsSync(jsonPath)) {
      const json = fs.readJsonSync(jsonPath, { throws: false })
      if (json && json.component) {
        return true
      }
    }
  }
  return false
}
