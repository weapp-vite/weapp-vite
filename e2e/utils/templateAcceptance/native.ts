import type { DomNodeExpectation, DomScope } from '../domAcceptance/types'
import type { TemplateDomRoute } from './index'
import { renderedText, templatePage } from './index'

const INDEX = '/pages/index/index'
const LAYOUTS = '/pages/layouts/index'

export function nativeLayouts(title: string, adminTitle: string, plain = false, statusSelector = plain ? '.hero__desc' : '.leading-7'): TemplateDomRoute {
  const titleSelector = plain ? '.hero__title' : '.text-2xl'
  const status = (value: string) => renderedText(statusSelector, `当前状态：${value}`)
  return templatePage(LAYOUTS, [
    renderedText(titleSelector, title),
    status('default'),
    { selector: 'component', has: '.layout-default', count: 1 },
  ], [
    {
      id: 'layouts:admin',
      action: 'applyAdminLayout and inspect the named layout and passed title',
      method: 'applyAdminLayout',
      nodes: [status('admin'), renderedText('.layout-admin__title', adminTitle, [{ has: '.layout-admin__title' }]), { selector: 'component', has: '.layout-default', count: 0 }],
    },
    {
      id: 'layouts:none',
      action: 'clearLayout and verify that the layout wrapper disappears',
      method: 'clearLayout',
      nodes: [status('none'), { selector: 'component', has: '.layout-admin', count: 0 }, { selector: 'component', has: '.layout-default', count: 0 }],
    },
    {
      id: 'layouts:default',
      action: 'applyDefaultLayout and restore the default wrapper',
      method: 'applyDefaultLayout',
      nodes: [status('default'), { selector: 'component', has: '.layout-default', count: 1 }, { selector: 'component', has: '.layout-admin', count: 0 }],
    },
  ])
}

export const NATIVE_TEMPLATE_DOM: TemplateDomRoute[] = [
  templatePage(INDEX, [
    renderedText('.hello-title', 'Hello weapp-vite', [{ has: '.hello-card' }]),
    renderedText('.hello-body', '这是最基础的 weapp-vite 模板，包含快速开发所需的构建与热更新能力。', [{ has: '.hello-card' }]),
    { selector: '.hello-button', scope: [{ has: '.hello-card' }], count: 2 },
    renderedText('button', '打开布局演示页'),
  ]),
  nativeLayouts('基础模板已接入 layouts', 'Native Console', true),
]

export function tailwindTemplateDom(kind: 'tailwind' | 'tdesign' | 'vant'): TemplateDomRoute[] {
  const titles = {
    tailwind: 'Hello weapp-vite',
    tdesign: 'Hello weapp-vite + TDesign',
    vant: 'Hello weapp-vite + Vant',
  }
  const layoutTitles = {
    tailwind: 'Tailwind 原生模板已接入 layouts',
    tdesign: 'TDesign 原生模板已接入 layouts',
    vant: 'Vant 原生模板已接入 layouts',
  }
  const adminTitles = { tailwind: 'Tailwind Console', tdesign: 'TDesign Console', vant: 'Vant Console' }
  const titleSelector = kind === 'tailwind' ? '.text-xl' : '.text-3xl'
  const titleScope: DomScope[] = [{ has: titleSelector }]
  const artworkScope: DomScope[] = kind === 'tdesign' ? titleScope : []
  const content: DomNodeExpectation[] = [
    {
      ...renderedText(titleSelector, titles[kind], titleScope),
      styles: {
        'font-size': { rpx: kind === 'tailwind' ? 40 : 60 },
        'line-height': { rpxCalc: { value: kind === 'tailwind' ? 40 : 60, multiply: kind === 'tailwind' ? 1.4 : 1.2 } },
      },
      visible: true,
    },
    {
      ...renderedText('.bg-linear-to-r', 'weapp-vite & weapp-tailwindcss', artworkScope),
      styles: {
        'background-image': 'linear-gradient(to right, rgb(5, 223, 114) 0%, rgb(0, 187, 253) 100%)',
      },
      visible: true,
    },
    {
      selector: '.w-24.h-24.bg-no-repeat',
      scope: artworkScope,
      count: 1,
      styles: {
        'background-image': 'url("https://vite.weapp.dev/logo.png")',
        'width': { rpxCalc: { value: 8, multiply: 24 } },
        'height': { rpxCalc: { value: 8, multiply: 24 } },
      },
      visible: true,
    },
    {
      selector: '.w-32.h-24.bg-no-repeat',
      scope: artworkScope,
      count: 1,
      styles: {
        'background-image': 'url("https://vite.weapp.dev/tw-logo.png")',
        'width': { rpxCalc: { value: 8, multiply: 32 } },
        'height': { rpxCalc: { value: 8, multiply: 24 } },
        'margin-left': { rpxCalc: { value: 8, multiply: 8 } },
      },
      visible: true,
    },
  ]
  const theme = (mode: 'light' | 'dark'): DomNodeExpectation => ({
    selector: mode === 'light' ? '.min-h-screen.bg-gray-100' : '.min-h-screen.bg-gray-900',
    styles: { 'background-color': mode === 'light' ? 'rgb(243, 244, 246)' : 'rgb(16, 24, 40)' },
    visible: true,
  })
  const routes = [templatePage(INDEX, [...content, theme('light')], [
    { id: 'index:dark', action: 'switchMode and inspect the rendered dark background', method: 'switchMode', nodes: [...content, theme('dark')] },
    { id: 'index:light', action: 'switchMode and restore the rendered light background', method: 'switchMode', nodes: [...content, theme('light')] },
  ])]
  if (kind === 'tailwind') {
    routes.push(templatePage('/pages/profile/index', [
      renderedText('.text-lg', 'ice breaker'),
      renderedText('.text-xl', 'Hello weapp-vite', [{ has: '.text-xl' }]),
      { selector: 'image', attributes: { src: '/logo.png' }, visible: true },
    ]))
  }
  routes.push(nativeLayouts(layoutTitles[kind], adminTitles[kind], false, kind === 'tailwind' ? '.bg-linear-to-br .leading-7' : undefined))
  return routes
}

export function multiPlatformTemplateDom(sfc: boolean): TemplateDomRoute[] {
  const nodes = [
    renderedText('.page-heading__title', sfc ? 'Vue SFC 多平台 + Web' : '原生多平台 + Web'),
    renderedText('#platform-marker', 'MP_PLATFORM=weapp'),
    renderedText('#runtime-status', 'status=ready'),
    renderedText(sfc ? '#component-platform' : '.platform-card__value', 'weapp', ['#platform-card-host']),
  ]
  const count = (value: number) => [
    renderedText('#counter-value', String(value)),
    ...(sfc ? [renderedText('#counter-doubled', `doubled=${value * 2}`)] : []),
  ]
  return [templatePage(INDEX, [...nodes, ...count(0)], [
    { id: 'index:increment', action: 'tap increment and inspect the rendered counter', tap: { selector: '#increment-button' }, nodes: [...nodes, ...count(1)] },
  ])]
}
