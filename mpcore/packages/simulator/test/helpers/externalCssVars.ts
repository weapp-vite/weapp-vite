export const externalCssVarsFiles: Array<[string, string]> = [
  ['pages/shared/index.js', `Component({options:{styleIsolation:'apply-shared'},data:{vars:'--theme:red',state:'initial',count:0},methods:{increment(){this.setData({count:this.data.count+1})}}})`],
  ['pages/shared/index.wxml', '<view id="external-vars" style="{{vars}}">{{state}}</view><button id="increment" bindtap="increment">{{count}}</button>'],
  ['pages/shared/index.wxss', '@import "../../styles/initial.wxss";'],
  ['styles/initial.wxss', '#external-vars { color:var(--theme); }'],
]

// 与真实编译器 HMR suite 的七步可观察契约一致，不用逻辑节点伪造计算样式。
export const externalCssVarsSteps = [
  { id: 'initial', file: 'initial', css: 'color:var(--theme)', vars: '--theme:red', color: 'rgb(255, 0, 0)', background: 'rgba(0, 0, 0, 0)' },
  { id: 'style-only', file: 'initial', css: 'color:var(--theme);background-color:yellow', vars: '--theme:red', color: 'rgb(255, 0, 0)', background: 'rgb(255, 255, 0)' },
  { id: 'source-switch', file: 'alternate', css: 'color:var(--theme);background-color:pink', vars: '--theme:red', color: 'rgb(255, 0, 0)', background: 'rgb(255, 192, 203)' },
  { id: 'replace-variable', file: 'alternate', css: 'color:var(--accent)', vars: '--accent:orange', color: 'rgb(255, 165, 0)', background: 'rgba(0, 0, 0, 0)' },
  { id: 'remove-variable', file: 'alternate', css: 'color:black', vars: '', color: 'rgb(0, 0, 0)', background: 'rgba(0, 0, 0, 0)' },
  { id: 'restore-variable', file: 'alternate', css: 'color:var(--theme)', vars: '--theme:red', color: 'rgb(255, 0, 0)', background: 'rgba(0, 0, 0, 0)' },
  { id: 'reactive', file: 'alternate', css: 'color:var(--theme)', vars: '--theme:blue', color: 'rgb(0, 0, 255)', background: 'rgba(0, 0, 0, 0)' },
] as const
