import type { App, Component, Page } from './type'
import process from 'node:process'

const SCHEMA_BASE = (process.env.WEAPP_SCHEMA_BASE ?? 'https://vite.icebreaker.top').replace(/\/$/, '')

function schemaUrl(filename: string) {
  return `${SCHEMA_BASE}/${filename}`
}

export const DEFAULT_APP_JSON: App = {
  $schema: schemaUrl('app.json'),
  usingComponents: {},
  pages: [
    'pages/index/index',
  ],
  sitemapLocation: 'sitemap.json',
}

export const DEFAULT_PAGE_JSON: Page = {
  $schema: schemaUrl('page.json'),
  usingComponents: {},
}

export const DEFAULT_COMPONENT_JSON: Component = {
  $schema: schemaUrl('component.json'),
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}

export const DEFAULT_JS_TEMPLATES = {
  app: 'App({})',
  page: 'Page({})',
  component: 'Component({})',
} as const
