import type { GenerateType, JsonExt } from './generator'
import type { App, Component, Page, Plugin, Sitemap, Theme } from './type'
import { generateJs as generateJsInternal } from './generators/js'
import { generateJson as generateJsonInternal } from './generators/json'
import { generateWxml as generateWxmlInternal } from './generators/wxml'
import { generateWxss as generateWxssInternal } from './generators/wxss'
import { JSON_SCHEMA_DEFINITIONS } from './json'

export type {
  App,
  Component,
  Page,
  Plugin,
  Sitemap,
  Theme,
}

export type { GenerateType }

// 导出 JSON Schema 定义，供其他包（如 @weapp-vite/volar）使用
export { JSON_SCHEMA_DEFINITIONS }

/**
 * @description 生成 JS 模板（app/page/component）
 */
export function generateJs(type?: GenerateType) {
  return generateJsInternal(type)
}

/**
 * @description 生成 WXSS 模板
 */
export function generateWxss() {
  return generateWxssInternal()
}

/**
 * @description 生成 WXML 模板
 */
export function generateWxml(filepath?: string) {
  return generateWxmlInternal({ filepath })
}

/**
 * @description 生成 JSON/JS/TS 模板
 */
export function generateJson(type?: GenerateType, ext: JsonExt = 'json') {
  return generateJsonInternal({ type, ext })
}
