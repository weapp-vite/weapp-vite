export const compiledTemplatePaths = ['pages/index/index.wxml', 'components/compiled/index.wxml'] as const

export function compiledPageTemplate(marker = 'BASE') {
  return `<view><text id="title">${marker}</text><text id="count">count: {{count}}</text><button id="increment" bindtap="increment">Increment</button><include src="../../fragments/body"/><import src="../../fragments/definitions"/><template is="message" data="{{count:count}}"/><compiled-panel id="compiled"/><native-panel id="native"/></view>`
}

export function compiledPageWithWxs(marker = 'BASE') {
  return compiledPageTemplate(marker).replace('<view>', `<view><wxs module="registration">var calls = 0; module.exports.label = function() { calls += 1; return 'WXS-${marker}:' + calls; };</wxs><text id="wxs-registration">{{registration.label()}}</text>`)
}

export function compiledTemplateFiles(): Array<[string, string]> {
  return [
    ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
    ['app.json', '{"pages":["pages/index/index","pages/other/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({data:{count:0},increment(){this.setData({count:this.data.count+1})}})'],
    ['pages/index/index.json', '{"usingComponents":{"compiled-panel":"/components/compiled/index","native-panel":"/components/native/index"}}'],
    ['pages/index/index.wxml', compiledPageTemplate()],
    ['pages/other/index.js', 'Page({})'],
    ['pages/other/index.wxml', '<text id="other">OTHER</text>'],
    ['fragments/body.wxml', '<text id="included">INCLUDE-BASE</text>'],
    ['fragments/definitions.wxml', '<template name="message"><text id="imported">IMPORT-BASE:{{count}}</text></template>'],
    ['components/compiled/index.js', 'Component({})'],
    ['components/compiled/index.json', '{"component":true}'],
    ['components/compiled/index.wxml', '<text id="compiled-title">COMPONENT-BASE</text>'],
    ['components/native/index.js', 'Component({})'],
    ['components/native/index.json', '{"component":true}'],
    ['components/native/index.wxml', '<text id="native-title">NATIVE-BASE</text>'],
  ]
}

export function compiledTemplateEdits(marker: string): Array<[string, string]> {
  return [
    ['pages/index/index.wxml', compiledPageTemplate(marker)],
    ['fragments/body.wxml', `<text id="included">INCLUDE-${marker}</text>`],
    ['fragments/definitions.wxml', `<template name="message"><text id="imported">IMPORT-${marker}:{{count}}</text></template>`],
    ['components/compiled/index.wxml', `<text id="compiled-title">COMPONENT-${marker}</text>`],
    ['components/native/index.wxml', `<text id="native-title">NATIVE-${marker}</text>`],
  ]
}
