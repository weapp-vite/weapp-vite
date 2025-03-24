import type { App as AppJson, Component as ComponentJson, Page as PageJson, Sitemap, Theme } from '@weapp-core/schematics'

export interface BaseEntry {
  path: string
  jsonPath?: string
  json?: object
  type: 'app' | 'page' | 'component' | (string & {})
}

export type Entry = AppEntry | PageEntry | ComponentEntry

/**
 * 应用入口 js + json
 */
export interface AppEntry extends BaseEntry {
  type: 'app'
  themeJsonPath?: string
  themeJson?: Theme
  sitemapJsonPath?: string
  sitemapJson?: Sitemap
  json: AppJson
  jsonPath: string
}

/**
 * 页面入口 js + wxml
 */
export interface PageEntry extends BaseEntry {
  type: 'page'
  templatePath: string
  json?: PageJson
}

/**
 * 组件入口 js + wxml + json + json.component === true
 */
export interface ComponentEntry extends BaseEntry {
  type: 'component'
  templatePath: string
  json: ComponentJson
  jsonPath: string
}

export type EntryJsonFragment = Omit<BaseEntry, 'path' | 'type'>
