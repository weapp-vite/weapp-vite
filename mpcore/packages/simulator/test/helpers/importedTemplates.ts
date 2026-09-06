export const importedTemplateFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { card: '/components/card' } })],
  ['pages/index/index.js', 'Component({ options: { multipleSlots: true }, data: { label: "initial" }, methods: { onLoad(query) { this.setData({ source: this.options.source, query: query.source }) } } })'],
  ['pages/index/index.wxml', '<import src="../../templates/card.wxml" /><template is="card" data="{{label:label}}" /><template is="private" data="{{label:label}}" /><card label="{{label}}" /><text id="query">{{source}}:{{query}}</text>'],
  ['templates/card.wxml', '<import src="./private.wxml" /><template name="card"><view id="card"><template is="private" data="{{label:label}}" /></view></template>'],
  ['templates/private.wxml', '<template name="private"><text class="label">{{label}}</text></template><view id="not-exported">hidden</view>'],
  ['components/card.json', JSON.stringify({ component: true })],
  ['components/card.js', 'Component({ properties: { label: String } })'],
  ['components/card.wxml', '<import src="/templates/private.wxml" /><template is="private" data="{{label:label}}" />'],
]
