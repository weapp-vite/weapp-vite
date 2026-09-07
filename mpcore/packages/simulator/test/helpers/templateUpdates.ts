export function templateUpdateSource(title: string) {
  return `<view><text id="title">${title}</text><text id="count">count: {{count}}</text><button id="increment" bindtap="increment">Increment</button></view>`
}

export const templateUpdateTitles = ['HMR', 'ONE', 'TWO', 'SIX', 'TEN']

export const templateUpdateFiles: Array<[string, string]> = [
  ['project.config.json', '{"appid":"wx123","miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index"]}'],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({data:{count:0},increment(){this.setData({count:this.data.count+1})}})'],
  ['pages/index/index.wxml', templateUpdateSource('HMR')],
]
