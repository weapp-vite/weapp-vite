import fs from 'fs-extra'
// import { jsExtensions } from '../constants'
import { findJsEntry, findJsonEntry } from './file'

// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// app: js + json
// export async function searchPageEntry(baseName: string) {
//   // if (await fs.exists(baseName)) {
//   for (const ext of jsExtensions) {
//     const entryPath = changeFileExtension(baseName, ext)
//     if (await fs.exists(entryPath)) {
//       return entryPath
//     }
//   }
//   // }
// }
// https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html
// page: wxml + js
// export async function isPage(baseName: string) {
//   return Boolean(await searchPageEntry(baseName))
// }

// export interface SearchAppEntryOptions {
//   root: string
//   formatPath?: (p: string) => string
// }

// component: wxml + js + json + json.component === true
// 这时候已经确定 wxml 存在了
export async function isComponent(baseName: string) {
  const jsEntry = await findJsEntry(baseName)
  if (jsEntry) {
    const jsonEntry = await findJsonEntry(baseName)
    if (jsonEntry) {
      const json = await fs.readJson(jsonEntry, { throws: false })
      if (json?.component) {
        return true
      }
    }
  }
  return false
}
