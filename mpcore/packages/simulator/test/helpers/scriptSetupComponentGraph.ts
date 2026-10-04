export const scriptSetupComponentGraphSteps = [
  { id: 'initial', marker: 'external-initial', component: 'AutoCard', text: 'auto-card' },
  { id: 'template-edit', marker: 'external-template', component: 'AutoCard', text: 'auto-card' },
  { id: 'script-edit', marker: 'external-template', component: 'AlternateCard', text: 'alternate-card' },
  { id: 'remove-template', marker: 'external-removed', component: null, text: null },
  { id: 'remove-script', marker: 'external-removed', component: null, text: null },
  { id: 'restore-script', marker: 'external-removed', component: null, text: null },
  { id: 'restore', marker: 'external-restored', component: 'AutoCard', text: 'auto-card' },
] as const

/** 对齐外部 SFC 依赖更新后宿主消费的模板、注册路径与组件输出。 */
export function createScriptSetupComponentGraphFiles(step: typeof scriptSetupComponentGraphSteps[number]): Array<[string, string]> {
  return [
    ['project.config.json', '{"appid":"wxb3d842a4a7e3440d","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: step.component ? { 'local-card': `/components/${step.component}/index` } : {} })],
    ['pages/index/index.wxml', `<view id="external-page"><view id="external-marker">${step.marker}</view>${step.component ? '<local-card id="external-card" />' : ''}</view>`],
    ...(['AutoCard', 'AlternateCard'] as const).flatMap(component => [
      [`components/${component}/index.js`, 'Component({})'],
      [`components/${component}/index.json`, '{"component":true}'],
      [`components/${component}/index.wxml`, `<view>${component === 'AutoCard' ? 'auto-card' : 'alternate-card'}</view>`],
    ] as Array<[string, string]>),
  ]
}
