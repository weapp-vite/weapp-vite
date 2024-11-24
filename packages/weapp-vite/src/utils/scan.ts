import fs from 'fs-extra'
import { jsExtensions } from '../constants'
import { changeFileExtension } from '../utils'

// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// app: js + json
export async function searchPageEntry(wxmlPath: string) {
  if (await fs.exists(wxmlPath)) {
    for (const ext of jsExtensions) {
      const entryPath = changeFileExtension(wxmlPath, ext)
      if (await fs.exists(entryPath)) {
        return entryPath
      }
    }
  }
}
// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// page: wxml + js
export async function isPage(wxmlPath: string) {
  return Boolean(await searchPageEntry(wxmlPath))
}

export interface SearchAppEntryOptions {
  root: string
  formatPath?: (p: string) => string
}

// component: wxml + js + json + json.component === true
export async function isComponent(wxmlPath: string) {
  if (await isPage(wxmlPath)) {
    const jsonPath = changeFileExtension(wxmlPath, 'json')
    if (await fs.exists(jsonPath)) {
      const json = await fs.readJson(jsonPath, { throws: false })
      if (json && json.component) {
        return true
      }
    }
  }
  return false
}
