export function nativeComponentPropertiesFiles(): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { declared: '/components/declared', undeclared: '/components/undeclared' } })],
    ['pages/index/index.js', `Page({ data: { __wv_style_0: '', title: 'parent title', subtitle: 'parent subtitle', passedTitle: 'attribute title' } })`],
    ['pages/index/index.wxml', `
<declared id="declared" title="{{passedTitle}}" style="{{__wv_style_0}}" />
<undeclared id="undeclared" title="{{passedTitle}}" data-note="host attribute">
  <text id="slot-title">{{title}}</text>
</undeclared>`],
    ['components/declared.json', '{"component":true}'],
    ['components/declared.js', `Component({ properties: { style: String, title: String, subtitle: { type: String, value: 'default subtitle' } } })`],
    ['components/declared.wxml', '<text id="declared-style">{{style}}</text><text id="declared-title">{{title}}</text><text id="declared-subtitle">{{subtitle}}</text>'],
    ['components/undeclared.json', '{"component":true}'],
    ['components/undeclared.js', `Component({ data: { local: 'component data' }, options: { multipleSlots: true } })`],
    ['components/undeclared.wxml', '<text id="undeclared-title">{{title}}</text><text id="undeclared-subtitle">{{subtitle}}</text><text id="local-data">{{local}}</text><slot />'],
  ]
}
