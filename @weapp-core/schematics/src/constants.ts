import type { App, Component, Page } from './type'

export const DEFAULT_APP_JSON: App = {
  $schema: 'https://vite.icebreaker.top/app.json',
  usingComponents: {},
  pages: [
    'pages/index/index',
  ],
  sitemapLocation: 'sitemap.json',
}

export const DEFAULT_PAGE_JSON: Page = {
  $schema: 'https://vite.icebreaker.top/page.json',
  usingComponents: {},
}

export const DEFAULT_COMPONENT_JSON: Component = {
  $schema: 'https://vite.icebreaker.top/component.json',
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}

export const DEFAULT_JS_TEMPLATES = {
  app: 'App({})',
  page: 'Page({})',
  component: 'Component({})',
} as const
