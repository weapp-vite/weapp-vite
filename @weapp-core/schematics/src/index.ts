import type { GenerateType, JsonExt } from './generator'
import type { App, Component, Page, Plugin, Sitemap, Theme } from './type'
import { generateJs as generateJsInternal } from './generators/js'
import { generateJson as generateJsonInternal } from './generators/json'
import { generateWxml as generateWxmlInternal } from './generators/wxml'
import { generateWxss as generateWxssInternal } from './generators/wxss'

export type {
  App,
  Component,
  Page,
  Plugin,
  Sitemap,
  Theme,
}

export type { GenerateType }

export function generateJs(type?: GenerateType) {
  return generateJsInternal(type)
}

export function generateWxss() {
  return generateWxssInternal()
}

export function generateWxml(filepath?: string) {
  return generateWxmlInternal({ filepath })
}

export function generateJson(type?: GenerateType, ext: JsonExt = 'json') {
  return generateJsonInternal({ type, ext })
}
