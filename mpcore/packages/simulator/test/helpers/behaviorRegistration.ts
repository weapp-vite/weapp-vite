export function createBehaviorRegistrationFiles(behavior: string, componentPage = false): Array<[string, string]> {
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: '.' })],
    ['app.js', 'App({})'],
    ['pages/index/index.js', componentPage ? `Component({ behaviors: [${behavior}] })` : 'Page({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { 'behavior-card': '/components/card' } })],
    ['pages/index/index.wxml', '<behavior-card />'],
    ['components/card.json', JSON.stringify({ component: true })],
    ['components/card.js', `Component({ behaviors: [${behavior}] })`],
    ['components/card.wxml', '<text id="behavior-result">{{label}}</text>'],
  ]
}

export const validNestedBehavior = `Behavior({ behaviors: ['wx://component-export', Behavior({ data: { label: 'constructed behavior' } })] })`
