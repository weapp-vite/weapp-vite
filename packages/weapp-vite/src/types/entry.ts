import type { App as AppJson, Component as ComponentJson, Page as PageJson, Sitemap, Theme } from '@weapp-core/schematics'

export interface BaseEntry {
  path: string
  jsonPath?: string
  json?: object
  type: 'app' | 'page' | 'component' | (string & {})
}

export type Entry = AppEntry | PageEntry | ComponentEntry

export interface AppEntry extends BaseEntry {
  type: 'app'
  themeJsonPath?: string
  themeJson?: Theme
  sitemapJsonPath?: string
  sitemapJson?: Sitemap
  json?: AppJson
}

export interface PageEntry extends BaseEntry {
  type: 'page'
  templatePath: string
  json?: PageJson
}

export interface ComponentEntry extends BaseEntry {
  type: 'component'
  templatePath: string
  json?: ComponentJson
}

export type EntryJsonFragment = Omit<BaseEntry, 'path' | 'type'>
