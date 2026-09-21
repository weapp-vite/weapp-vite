export function nativeSlotTemplate(name: string) {
  return `<test-layout><view id="probe" data-color="${name}" class="{{dark ? 'dark' : '${name}'}}">Probe</view><button id="toggle" bindtap="toggle">{{count}}</button></test-layout>`
}

export function nativeSlotStyles(name: string, color: string) {
  return `.${name} { background-color: ${color}; } .dark { background-color: #101828; }`
}

export function nativePageStyleSlotFiles(): Array<[string, string]> {
  const styles = nativeSlotStyles('initial', '#f3f4f6')
  return [
    ['app.json', '{"pages":["pages/shared/index"]}'],
    ['app.js', 'App({})'],
    ['app.wxss', '@import "./global.wxss";'],
    ['global.wxss', styles],
    ['pages/shared/index.js', 'Page({data:{dark:false,count:0},toggle(){this.setData({dark:!this.data.dark,count:this.data.count+1})}})'],
    ['pages/shared/index.json', '{"usingComponents":{"test-layout":"/layout/index"}}'],
    ['pages/shared/index.wxml', nativeSlotTemplate('initial')],
    ['pages/shared/index.wxss', `${styles} #probe { height:100px; }`],
    ['layout/index.js', 'Component({})'],
    ['layout/index.json', '{"component":true,"styleIsolation":"apply-shared"}'],
    ['layout/index.wxml', '<view><slot /></view>'],
    ['layout/index.wxss', 'view { min-height: 100%; }'],
  ]
}
