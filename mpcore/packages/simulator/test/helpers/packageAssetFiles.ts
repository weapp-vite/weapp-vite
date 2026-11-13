export const packageAssetFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ miniprogramRoot: 'dist' })],
  ['dist/app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/second/index'], tabBar: { list: [
    { pagePath: 'pages/index/index', text: 'First', iconPath: 'tabbar.png' },
    { pagePath: 'pages/second/index', text: 'Second', iconPath: 'tabbar.png' },
  ] } })],
  ['dist/tabbar.png', 'tabbar-icon'],
  ['dist/pages/second/index.js', 'Page({})'],
  ['dist/pages/second/index.wxml', '<view>Second</view>'],
  ['dist/app.js', 'App({})'],
  ['dist/pages/index/index.js', `Page({
    data: { content: '', count: 2, imageInfo: '' },
    read() {
      try { this.setData({ content: wx.getFileSystemManager().readFileSync('resources/live.png', 'utf8') }) }
      catch { this.setData({ content: 'missing' }) }
    },
    readImage() {
      wx.getImageInfo({
        src: '/resources/live.png',
        success: result => this.setData({ imageInfo: result.type }),
        fail: () => this.setData({ imageInfo: 'missing' }),
      })
    },
  })`],
  ['dist/pages/index/index.wxml', '<view id="content">{{content}}</view><view id="count">{{count}}</view><view id="image-info">{{imageInfo}}</view>'],
]
