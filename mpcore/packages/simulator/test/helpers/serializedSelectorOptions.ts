export function serializedSelectorOptionsFiles(): Array<[string, string]> {
  return [
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', `Page({
      data: { snapshot: [] },
      inspect() {
        const fields = JSON.parse(JSON.stringify({
          id: true, dataset: true, rect: true, size: true, computedStyle: ['color']
        }))
        wx.createSelectorQuery().selectAll('#probe').fields(fields, nodes => {
          this.setData({ snapshot: nodes })
        }).exec()
      }
    })`],
    ['pages/index/index.wxml', '<view id="probe" data-state="ready" style="width:80px;height:20px;color:rgb(81, 81, 124)">probe</view>'],
  ]
}
