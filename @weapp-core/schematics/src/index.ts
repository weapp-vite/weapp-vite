import type { App, Component, Page } from './type.auto'

export type {
  App,
  Component,
  Page,
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
export function generateWxml(text?: string) {
  return `<view>${text ?? 'hello weapp-vite!'}</view>`
}

export function generateJson(type?: GenerateType) {
  if (type === 'app') {
    return {
      $schema: 'https://vite.icebreaker.top/app.json',
      usingComponents: {},
      pages: [
        'pages/index/index',
      ],
    } as App
  }
  else if (type === 'page') {
    return {
      $schema: 'https://vite.icebreaker.top/page.json',
      usingComponents: {},
    } as Page
  }
  else {
    return {
      $schema: 'https://vite.icebreaker.top/component.json',
      component: true,
      usingComponents: {},
    } as Component
  }
}
