export function pageStyleTemplate(name: string) {
  return `<view><view id="import-probe" class="tone-${name}">${name}</view><view id="local-probe" class="local-probe">Local</view><text id="count">count: {{count}}</text><button id="increment" bindtap="increment">Increment</button></view>`
}

export function pageStyleGlobal(name: string, color: string) {
  return `.tone-${name} { background-color: ${color}; } .local-probe { background-color: ${color}; }`
}

export function pageStylePage(source: PageStyleSource, name: string, color: string) {
  const globalStyles = source === 'inline' ? pageStyleGlobal(name, color) : '@import "../../styles/global.wxss";'
  return `${globalStyles} .local-probe { background-color: rgb(31, 41, 55); }`
}

export function createPageStyleImportFiles(source: PageStyleSource = 'imported'): Array<[string, string]> {
  return [
    ['app.json', '{"pages":["pages/shared/index","pages/isolated/index"]}'],
    ['app.js', 'App({globalData:{launches:0},onLaunch(){this.globalData.launches++}})'],
    ['app.wxss', '@import "./styles/global.wxss";'],
    ['styles/global.wxss', '@import "./palette.wxss";'],
    ['styles/palette.wxss', pageStyleGlobal('initial', 'rgb(219, 234, 254)')],
    ['pages/shared/index.js', `Component({options:{styleIsolation:'apply-shared'},data:{count:0},methods:{increment(){this.setData({count:this.data.count+1})}}})`],
    ['pages/shared/index.wxml', pageStyleTemplate('initial')],
    ['pages/shared/index.wxss', pageStylePage(source, 'initial', 'rgb(219, 234, 254)')],
    ['pages/isolated/index.js', `Component({options:{styleIsolation:'page-isolated'},data:{count:0},methods:{increment(){this.setData({count:this.data.count+1})}}})`],
    ['pages/isolated/index.wxml', pageStyleTemplate('initial')],
    ['pages/isolated/index.wxss', '.local-probe { background-color: rgb(31, 41, 55); }'],
  ]
}
export type PageStyleSource = 'imported' | 'inline'

export function createIssue779StyleOutputFiles(): Array<[string, string]> {
  // 这里只接收编译产物；pre 插件不得被磁盘原文覆盖的契约由 weapp-vite 的真实 Vite integration 验证。
  return [
    ['app.json', '{"pages":["pages/issue-779/index"]}'],
    ['app.js', 'App({})'],
    ['app.wxss', ''],
    ['pages/issue-779/index.js', 'Page({})'],
    ['pages/issue-779/index.wxml', '<view id="issue779-page" class="issue-779-page issue-779-pre-marker">issue 779</view>'],
    ['pages/issue-779/index.wxss', '@import "../../styles/issue-779-preprocessed.wxss";'],
    ['styles/issue-779-preprocessed.wxss', '.issue-779-pre-marker { padding: 13px; color: rgb(1, 2, 3); }'],
  ]
}

export function issue892SharedStyleOutput(color: string) {
  return `.issue-892-shared-style { color: ${color}; }`
}

export function createIssue892SharedStyleOutputFiles(): Array<[string, string]> {
  // Sass 原子保存及编译依赖归属由 weapp-vite 的 integration 与 IDE case 验证；这里只接收最终样式产物。
  return [
    ['app.json', '{"pages":["pages/shared/index"]}'],
    ['app.js', 'App({})'],
    ['app.wxss', '@import "./styles/issue-892-shared.wxss";'],
    ['styles/issue-892-shared.wxss', issue892SharedStyleOutput('#2468ac')],
    ['pages/shared/index.js', 'Page({})'],
    ['pages/shared/index.wxml', '<view id="issue-892-shared-style" class="issue-892-shared-style">shared Sass asset</view>'],
    ['pages/shared/index.wxss', ''],
  ]
}
