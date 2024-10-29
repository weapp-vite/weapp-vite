import type { App, Component, Page, Sitemap, Theme } from '@weapp-core/schematics'

export type {
  App,
  Component,
  Page,
  Sitemap,
  Theme,
}

interface DefineJsonFn<T> {
  (config: T): T
}

export const defineAppJson: DefineJsonFn<App> = (config) => {
  return config
}

export const definePageJson: DefineJsonFn<Page> = (config: Page) => {
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
