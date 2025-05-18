import type { App, Component, Page, Plugin, Sitemap, Theme } from './type'

export type {
  App,
  Component,
  Page,
  Plugin,
  Sitemap,
  Theme,
}

export type GenerateType = 'app' | 'page' | 'component'

export function generateJs(type?: GenerateType) {
  if (type === 'app') {
    return `App({})`
  }
  else if (type === 'page') {
    return `Page({})`
  }
  else {
    return `Component({})`
  }
}

export function generateWxss() {
  return ''
}

// 生成 app 时候没有 app.wxml
export function generateWxml(filepath?: string) {
  return `<view>hello weapp-vite!</view>
${filepath ? `<view>from ${filepath}</view>` : ''}`
}

function JSONStringify(res: any) {
  return JSON.stringify(res, undefined, 2)
}

export function generateJson(type?: GenerateType, ext: 'json' | 'js' | 'ts' | (string & {}) = 'json') {
  if (type === 'app') {
    if (ext === 'ts') {
      return `import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages: [
    'pages/index/index',
  ],
  usingComponents: {},
})
`
    }
    else if (ext === 'js') {
      return `import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages: [
    'pages/index/index',
  ],
  usingComponents: {},
})
`
    }
    else {
      return JSONStringify({
        $schema: 'https://ice-vite.netlify.app/app.json',
        usingComponents: {},
        pages: [
          'pages/index/index',
        ],
        sitemapLocation: 'sitemap.json',
      } as App)
    }
  }
  else if (type === 'page') {
    if (ext === 'ts') {
      return `import { definePageJson } from 'weapp-vite/json'

export default definePageJson({
  usingComponents: {},
})
`
    }
    else if (ext === 'js') {
      return `import { definePageJson } from 'weapp-vite/json'

export default definePageJson({
  usingComponents: {},
})
`
    }
    else {
      return JSONStringify({
        $schema: 'https://ice-vite.netlify.app/page.json',
        usingComponents: {},
      } as Page)
    }
  }
  else {
    if (ext === 'ts') {
      return `import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
`
    }
    else if (ext === 'js') {
      return `import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
`
    }
    else {
      return JSONStringify({
        $schema: 'https://ice-vite.netlify.app/component.json',
        component: true,
        styleIsolation: 'apply-shared',
        usingComponents: {},
      } as Component)
    }
  }
}
