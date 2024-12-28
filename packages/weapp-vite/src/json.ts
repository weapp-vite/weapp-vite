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

export const defineAppJson: DefineJsonFn<App> = (config) => {
  return config
}

export const definePageJson: DefineJsonFn<Page> = (config) => {
  return config
}

export const defineComponentJson: DefineJsonFn<Component> = (config) => {
  return config
}

export const defineSitemapJson: DefineJsonFn<Sitemap> = (config) => {
  return config
}

export const defineThemeJson: DefineJsonFn<Theme> = (config) => {
  return config
}
