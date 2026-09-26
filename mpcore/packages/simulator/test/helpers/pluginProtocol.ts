export function pluginProtocolFiles(pluginRoot = 'plugin'): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.', pluginRoot })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'], plugins: { hello: { provider: 'wxpluginprovider', version: 'dev' } } })],
    ['app.js', 'App({})'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: { 'plugin-meter': 'plugin://hello/meter' } })],
    ['pages/index/index.js', `const plugin = requirePlugin('hello')
Page({
  data: { score: 78, answer: plugin.answer },
  increment() { this.setData({ score: this.data.score + 6 }) },
})`],
    ['pages/index/index.wxml', '<view><text id="host-title">Plugin host</text><text id="plugin-answer">plugin.answer = {{answer}}</text><plugin-meter value="{{score}}"/><button id="host-increment" bindtap="increment">Increase plugin score</button></view>'],
    [`${pluginRoot}/plugin.json`, JSON.stringify({ main: 'index.js', pages: { 'hello-page': 'pages/hello/index' }, publicComponents: { meter: 'components/meter/index' } })],
    [`${pluginRoot}/index.js`, 'exports.answer = 42'],
    [`${pluginRoot}/components/meter/index.json`, JSON.stringify({ component: true })],
    [`${pluginRoot}/components/meter/index.js`, 'Component({ properties: { value: Number } })'],
    [`${pluginRoot}/components/meter/index.wxml`, '<view><text id="meter-label">Plugin score</text><text id="meter-value">{{value}}%</text></view>'],
    [`${pluginRoot}/pages/hello/index.json`, JSON.stringify({ usingComponents: { 'plugin-meter': '../../components/meter/index' } })],
    [`${pluginRoot}/pages/hello/index.js`, `Page({
  data: { title: 'Plugin page', score: 94, cards: ['Vue SFC', 'Native components', 'Styles', 'Navigation'] },
  increment() { this.setData({ score: this.data.score + 6 }) },
})`],
    [`${pluginRoot}/pages/hello/index.wxml`, '<view><text id="plugin-title">{{title}}</text><view class="plugin-card" wx:for="{{cards}}" wx:key="*this">{{item}}</view><plugin-meter value="{{score}}"/><button id="increment" bindtap="increment">Increase score</button></view>'],
  ]
}
