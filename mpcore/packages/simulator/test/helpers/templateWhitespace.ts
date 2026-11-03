export const templateWhitespaceStates = [' ', '  ', '', 'updated', ' '] as const

export function templateWhitespaceChecks(space: string) {
  return [
    ['#static-inline', 'AB'],
    ['#static-multiple', 'AB'],
    ['#static-newline', 'AB'],
    ['#static-only', ''],
    ['#dynamic-inline', 'A B'],
    ['#bound-inline', `A${space}B`],
    ['#bound-only', space],
    ['#nonempty', '  A  B  '],
    ['#mixed', 'prefix  alpha  suffix'],
  ] as const
}

/** 对齐真实 IDE 中格式化 JSX 动态岛、静态纯空白与显式绑定空格。 */
export const templateWhitespaceFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index","pages/whitespace/index"]}'],
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
  ['pages/whitespace/index.js', 'Page({data:{space:" ",label:"alpha"}})'],
  ['pages/whitespace/index.wxml', '<view id="static-inline"><text>A</text> <text>B</text></view><view id="static-multiple"><text>A</text>   <text>B</text></view><view id="static-newline"><text>A</text>\n  <text>B</text></view><text id="static-only">   </text><view id="dynamic-inline"><text>A</text>{{\' \'}}<text>B</text></view><view id="bound-inline"><text>A</text>{{space}}<text>B</text></view><text id="bound-only">{{space}}</text><text id="nonempty">  A  B  </text><text id="mixed">prefix  {{label}}  suffix</text>'],
]
