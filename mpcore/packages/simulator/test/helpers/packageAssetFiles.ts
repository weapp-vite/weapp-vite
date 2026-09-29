export const packageAssetFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: 'dist' })],
  ['dist/app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['dist/app.js', 'App({})'],
  ['dist/pages/index/index.js', `Page({
    data: { content: '', count: 2 },
    read() {
      try { this.setData({ content: wx.getFileSystemManager().readFileSync('resources/live.png', 'utf8') }) }
      catch { this.setData({ content: 'missing' }) }
    },
  })`],
  ['dist/pages/index/index.wxml', '<view id="content">{{content}}</view><view id="count">{{count}}</view>'],
]
