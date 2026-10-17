export const renderFailureFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({globalData:{throwOnDetach:true, detached:[], callbacks:[]}})'],
  ['pages/index/index.json', '{"usingComponents":{"relation-parent":"../../components/parent/index"}}'],
  ['pages/index/index.js', 'Page({data:{visible:true,count:0}})'],
  ['pages/index/index.wxml', '<relation-parent id="parent" visible="{{visible}}" /><view id="count">{{count}}</view>'],
  ['components/parent/index.json', '{"component":true,"usingComponents":{"failure-child":"../child/index"}}'],
  ['components/parent/index.js', `Component({
    properties: {visible: Boolean},
    relations: {'../child/index': {type: 'child'}},
  })`],
  ['components/parent/index.wxml', '<failure-child wx:if="{{visible}}" id="first" name="first" /><failure-child wx:if="{{visible}}" id="second" name="second" />'],
  ['components/child/index.json', '{"component":true}'],
  ['components/child/index.js', `Component({
    properties: {name: String},
    relations: {'../parent/index': {type: 'parent'}},
    lifetimes: {
      detached() {
        const state = getApp().globalData
        state.detached.push(this.data.name)
        this.setData({detached: true}, () => state.callbacks.push(this.data.name))
        if (this.data.name === 'first' && state.throwOnDetach) {
          throw new Error('detached hook failed')
        }
      },
    },
  })`],
  ['components/child/index.wxml', '<view class="child">{{name}}</view>'],
]
