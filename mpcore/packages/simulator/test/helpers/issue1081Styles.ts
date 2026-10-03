/** 使用编译后的动态类绑定验证宿主；CSS Modules 编译本身由真实 CLI fixture 验证。 */
export const issue1081Styles: Array<[string, string]> = [
  ['pages/shared/index.js', `Component({options:{styleIsolation:'apply-shared'},data:{count:0,moduleClass:'panel_initial'},methods:{increment(){this.setData({count:this.data.count+1})}}})`],
  ['pages/shared/index.wxml', '<view id="module-panel" class="{{moduleClass}}">module panel</view><text id="count">count: {{count}}</text><button id="increment" bindtap="increment">Increment</button>'],
  ['pages/shared/index.wxss', '.panel_initial { color: rgb(17, 34, 51); }'],
]
