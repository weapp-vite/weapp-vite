import { processWxml } from '@/wxml'
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
describe('wxml', () => {
  it('processWxml case bind', () => {
    const { code, deps, components } = processWxml('<view @tap="hello"></view>')
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case bind case 0', () => {
    const { code, deps, components } = processWxml('<view @tap.="hello"></view>')
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case bind case 1', () => {
    const { code, deps, components } = processWxml('<view @tap.xx="hello"></view>')
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case bind case 2', () => {
    const { code, deps, components } = processWxml('<view @tap.xx.a.a..="hello"></view>')
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case catch', () => {
    const { code, deps, components } = processWxml('<view @tap.catch="hello"></view>')
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case catch case 0', () => {
    const { code, deps, components } = processWxml('<view @tap.catch.....="hello"></view>')
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case catch case 1', () => {
    const { code, deps, components } = processWxml('<view @tap.....catch.....="hello"></view>')
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case mut-bind', () => {
    const { code, deps, components } = processWxml('<view @tap.mut="hello"></view>')
    expect(code).toBe('<view mut-bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case capture-bind', () => {
    const { code, deps, components } = processWxml('<view @tap.capture="hello"></view>')
    expect(code).toBe('<view capture-bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case capture-catch', () => {
    const { code, deps, components } = processWxml('<view @tap.capture.catch="hello"></view>')
    expect(code).toBe('<view capture-catch:tap="hello"></view>')
    const { code: code1 } = processWxml('<view @tap.catch.capture="hello"></view>')
    expect(code1).toBe('<view capture-catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml case inline', () => {
    const { code, deps, components } = processWxml(`<view>{{test.foo}}</view>

<wxs module="test" lang="ts">
const { bar, foo } = require('./index.wxs.js')
const bbc = require('./bbc.wxs')
export const abc = 'abc'

export {
  foo,
  bar,
  bbc
}
</wxs>`)
    expect(code).toMatchSnapshot()
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml deps case 0', () => {
    const { code, deps, components } = processWxml('<wxs src="xx.wxs.ts"></wxs>')
    expect(code).toBe('<wxs src="xx.wxs"></wxs>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml deps case 1', () => {
    const { code, deps, components } = processWxml('<wxs src="xx.wxs.ts"/>')
    expect(code).toBe('<wxs src="xx.wxs"/>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 0', () => {
    const { code, deps, components } = processWxml('<ABAB></ABAB>')
    expect(code).toBe('<ABAB></ABAB>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 1', () => {
    const wxml = `<view>Apple</view>
<view class="button-example">
  <t-button theme="primary" size="large">填充按钮</t-button>
  <t-button theme="light" size="large">填充按钮</t-button>
  <t-button size="large">填充按钮</t-button>
</view>
<view class="button-example">
  <t-button theme="primary" size="large" variant="outline">描边按钮</t-button>
  <t-button theme="primary" size="large" variant="text">文字按钮</t-button>
</view>`
    const { code, deps, components } = processWxml(wxml)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 2', () => {
    const wxml = `<t-divider/>`
    const { code, deps, components } = processWxml(wxml)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 3', () => {
    const wxml = `<t-divider    />`
    const { code, deps, components } = processWxml(wxml)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 4', () => {
    const wxml = `<view class="text-yellow-800 {{className}}">Test Page</view>
<button class="{{buttonClass}}">buttonClass</button>
<view>A = {{a}}</view>
<view>B = {{b}}</view>
<view>SUM = {{sum}}</view>
<button bindtap="onTap">click</button>
<HiChina></HiChina>
<icebreaker></icebreaker>
<t-button>Auto import</t-button>
<t-divider/>
<t-fab>Auto import</t-fab>
<t-link>Auto import</t-link>
<t-input></t-input>`
    const { code, deps, components } = processWxml(wxml)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('processWxml components case 5', () => {
    const wxml = `
<t-divider/>
<t-fab>Auto import</t-fab>

`
    const { code, deps, components } = processWxml(wxml)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
    expect(Object.keys(components).includes('t-divider')).toBe(true)
  })

  it('processWxml if case 0', () => {
    const wxml = `
    <!--  #ifdef  tt      -->
<t-divider/>
<t-fab>Auto import</t-fab>
<!--  #endif -->
`
    const { code, removeStartStack, removeEndStack } = processWxml(wxml)
    expect(removeStartStack).toEqual([5])
    expect(removeEndStack).toEqual([87])
    expect(code.trim()).toBe('')
  })

  it('processWxml if case 1', () => {
    const wxml = `
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const { code } = processWxml(wxml)
    expect(code.trim()).toBe('')
  })

  it('processWxml if case 2', () => {
    const wxml = `
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const { code } = processWxml(wxml, { platform: 'alipay' })
    expect(code.trim()).toBe('<t-divider/>')
  })

  it('processWxml if case 3', () => {
    const wxml = `
    <!--  #endif -->
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const { code } = processWxml(wxml, { platform: 'alipay' })
    expect(code.trim()).toBe('<t-divider/>')
  })

  it('processWxml if case 4', () => {
    const wxml = `
    <!--  #endif -->
<t-button/>
<!--  #ifdef  alipay      -->
<!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const { code } = processWxml(wxml, { platform: 'alipay' })
    expect(code.trim()).toBe('<t-button/>\n\n\n<t-divider/>')
  })

  it('processWxml components case 6', () => {
    const wxml = `  <HelloWorld></HelloWorld>
      <navigation-bar></navigation-bar>`
    const { components } = processWxml(wxml)
    expect(Object.keys(components).length).toBe(1)
  })
})
