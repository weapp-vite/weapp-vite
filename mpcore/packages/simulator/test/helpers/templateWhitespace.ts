/** 对齐真实 IDE 中格式化 JSX 动态岛的模板缩进与显式空格。 */
export const templateWhitespaceFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({data:{count:0},increment(){this.setData({count:this.data.count+1})}})'],
  ['pages/index/index.wxml', `
<button id="island" bindtap="increment">
  <template is="fragment" data="{{count:count}}" />
</button>
<template name="fragment">
  <block>dynamic island:</block>
  <block>{{' '}}</block>
  <block>{{count}}</block>
</template>
<text id="explicit">{{'  spaced  '}}</text>
`],
]
