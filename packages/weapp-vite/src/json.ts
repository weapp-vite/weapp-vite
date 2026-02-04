import type { App, Component, Page, Sitemap, Theme } from '@weapp-core/schematics'
import type { CompilerContext } from './context/index'

export type {
  App,
  Component,
  Page,
  Sitemap,
  Theme,
}

type ReturnSelf<T> = (config: T) => T

type ConfigFn<T> = T | ((ctx: CompilerContext) => T)

type DefineJsonFn<T> = ReturnSelf<ConfigFn<T>>

/**
 * @description 定义 app.json（支持直接对象或函数形式）
 */
export const defineAppJson: DefineJsonFn<App> = (config) => {
  return config
}

/**
 * @description 定义 page.json（支持直接对象或函数形式）
 */
export const definePageJson: DefineJsonFn<Page> = (config) => {
  return config
}

/**
 * @description 定义 component.json（支持直接对象或函数形式）
 */
export const defineComponentJson: DefineJsonFn<Component> = (config) => {
  return config
}

/**
 * @description 定义 sitemap.json（支持直接对象或函数形式）
 */
export const defineSitemapJson: DefineJsonFn<Sitemap> = (config) => {
  return config
}

/**
 * @description 定义 theme.json（支持直接对象或函数形式）
 */
export const defineThemeJson: DefineJsonFn<Theme> = (config) => {
  return config
}
