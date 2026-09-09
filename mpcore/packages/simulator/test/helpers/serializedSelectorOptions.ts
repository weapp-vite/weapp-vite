export function serializedSelectorOptionsFiles(): Array<[string, string]> {
  return [
    ['app.json', '{"pages":["pages/index/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', `Page({
      data: { snapshot: [], sizes: [] },
      inspectSizes() {
        const fields = JSON.parse('{"size":true}')
        const query = wx.createSelectorQuery()
        query.select('#probe').fields(fields)
        query.select('#second').fields(fields)
        query.select('#third').fields(fields)
        query.exec(sizes => this.setData({ sizes }))
      },
      inspect() {
        const fields = JSON.parse(JSON.stringify({
          id: true, dataset: true, rect: true, size: true, computedStyle: ['color']
        }))
        wx.createSelectorQuery().selectAll('#probe').fields(fields, nodes => {
          this.setData({ snapshot: nodes })
        }).exec()
      }
    })`],
    ['pages/index/index.wxml', '<view id="probe" data-state="ready" style="width:80px;height:20px;color:rgb(81, 81, 124)">probe</view><view id="second" style="width:40px;height:10px"></view><view id="third" style="width:60px;height:30px"></view>'],
  ]
}
