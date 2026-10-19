export const localPluginLayouts = ['P', 'W'] as const

export type LocalPluginLayout = typeof localPluginLayouts[number]

export const localPluginProvider = 'wxb3d842a4a7e3440d'
export const localPluginPageRoute = `plugin-private://${localPluginProvider}/pages/hello/index`

export function createLocalPluginLayout(layout: LocalPluginLayout) {
  const hostRoot = layout === 'P' ? 'dist/' : ''
  const projectConfig = {
    appid: localPluginProvider,
    compileType: 'plugin',
    miniprogramRoot: hostRoot || './',
    pluginRoot: 'dist-plugin/',
    setting: {
      localPlugins: true,
      packNpmManually: layout === 'P',
      packNpmRelationList: layout === 'P'
        ? [{ packageJsonPath: './package.json', miniprogramNpmDistDir: './dist' }]
        : [],
    },
    srcMiniprogramRoot: hostRoot || './',
  }
  const appConfig = {
    pages: ['pages/index/index'],
    plugins: { hello: { provider: localPluginProvider, version: 'dev' } },
    subPackages: [],
  }
  const pluginConfig = {
    main: 'index.js',
    pages: { 'hello-page': 'pages/hello/index' },
    publicComponents: { card: 'components/card/index' },
  }
  const files: Array<[string, string]> = [
    ['project.config.json', JSON.stringify(projectConfig)],
    ['package.json', JSON.stringify({ name: 'local-plugin-fixture', private: true })],
    [`${hostRoot}app.json`, JSON.stringify(appConfig)],
    [`${hostRoot}app.js`, 'App({})'],
    [`${hostRoot}pages/index/index.json`, JSON.stringify({
      usingComponents: { 'plugin-card': 'plugin://hello/card' },
    })],
    [`${hostRoot}pages/index/index.js`, `
const plugin = requirePlugin('hello')
Page({
  data: { pluginAnswer: plugin.answer },
  readPluginAnswer() {
    this.setData({ apiAnswer: plugin.answer })
    return plugin.answer
  },
  openPluginPage() {
    return new Promise((resolve, reject) => {
      wx.navigateTo({ url: 'plugin://hello/hello-page?source=host', success: resolve, fail: reject })
    })
  },
})
`],
    [`${hostRoot}pages/index/index.wxml`, '<view><text id="plugin-answer">plugin.answer = {{pluginAnswer}}</text><plugin-card id="local-plugin-card" label="{{pluginAnswer}}" /></view>'],
    ['dist-plugin/plugin.json', JSON.stringify(pluginConfig)],
    ['dist-plugin/index.js', 'exports.answer = 42'],
    ['dist-plugin/components/card/index.json', JSON.stringify({ component: true })],
    ['dist-plugin/components/card/index.js', 'Component({ properties: { label: Number } })'],
    ['dist-plugin/components/card/index.wxml', '<view id="plugin-card-content">plugin card: {{label}}</view>'],
    ['dist-plugin/pages/hello/index.json', '{}'],
    ['dist-plugin/pages/hello/index.js', 'Page({ data: { title: "plugin page" } })'],
    ['dist-plugin/pages/hello/index.wxml', '<view id="local-plugin-page">{{title}}</view>'],
  ]
  return { appConfig, files, hostRoot, pluginConfig, projectConfig }
}

export function createLocalPluginDemoFiles(layout: LocalPluginLayout): Array<[string, string]> {
  const { files, hostRoot } = createLocalPluginLayout(layout)
  // demo 只接收既有虚拟根格式；磁盘 P/W 路径解析由 Node 和 browserSession 用例覆盖。
  return files.flatMap(([filePath, content]): Array<[string, string]> => {
    if (filePath.startsWith('dist-plugin/')) {
      return [[filePath.replace(/^dist-plugin\//, '__plugins__/hello/'), content]]
    }
    if (filePath === 'project.config.json' || filePath === 'package.json') {
      return []
    }
    return [[filePath.slice(hostRoot.length), content]]
  })
}
