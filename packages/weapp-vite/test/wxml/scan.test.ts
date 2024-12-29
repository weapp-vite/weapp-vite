import { handleWxml } from '@/wxml/handle'
import { scanWxml } from '@/wxml/scan'

// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
describe('wxml', () => {
  it('scanWxml case bind', () => {
    const res = scanWxml('<view @tap="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case bind case 0', () => {
    const res = scanWxml('<view @tap.="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case bind case 1', () => {
    const res = scanWxml('<view @tap.xx="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case bind case 2', () => {
    const res = scanWxml('<view @tap.xx.a.a..="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case catch', () => {
    const res = scanWxml('<view @tap.catch="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case catch case 0', () => {
    const res = scanWxml('<view @tap.catch.....="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case catch case 1', () => {
    const res = scanWxml('<view @tap.....catch.....="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case mut-bind', () => {
    const res = scanWxml('<view @tap.mut="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view mut-bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case capture-bind', () => {
    const res = scanWxml('<view @tap.capture="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view capture-bind:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case capture-catch', () => {
    const res = scanWxml('<view @tap.capture.catch="hello"></view>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<view capture-catch:tap="hello"></view>')
    const res1 = scanWxml('<view @tap.catch.capture="hello"></view>')
    const { code: code1 } = handleWxml(res1)
    expect(code1).toBe('<view capture-catch:tap="hello"></view>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml case inline', () => {
    const res = scanWxml(`<view>{{test.foo}}</view>

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
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toMatchSnapshot()
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml deps case 0', () => {
    const res = scanWxml('<wxs src="xx.wxs.ts"></wxs>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<wxs src="xx.wxs"></wxs>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml deps case 1', () => {
    const res = scanWxml('<wxs src="xx.wxs.ts"/>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<wxs src="xx.wxs"/>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 0', () => {
    const res = scanWxml('<ABAB></ABAB>')
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe('<ABAB></ABAB>')
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 1', () => {
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
    const res = scanWxml(wxml)
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 2', () => {
    const wxml = `<t-divider/>`
    const res = scanWxml(wxml)
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 3', () => {
    const wxml = `<t-divider    />`
    const res = scanWxml(wxml)
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 4', () => {
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
    const res = scanWxml(wxml)
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
  })

  it('scanWxml components case 5', () => {
    const wxml = `
<t-divider/>
<t-fab>Auto import</t-fab>

`
    const res = scanWxml(wxml)
    const { deps, components } = res
    const { code } = handleWxml(res)
    expect(code).toBe(wxml)
    expect(deps).toMatchSnapshot('deps')
    expect(components).toMatchSnapshot('components')
    expect(Object.keys(components).includes('t-divider')).toBe(true)
  })

  it('scanWxml if case 0', () => {
    const wxml = `
    <!--  #ifdef  tt      -->
<t-divider/>
<t-fab>Auto import</t-fab>
<!--  #endif -->
`
    const res = scanWxml(wxml)
    const { removeStartStack, removeEndStack } = res
    const { code } = handleWxml(res)
    expect(removeStartStack).toEqual([5])
    expect(removeEndStack).toEqual([87])
    expect(code.trim()).toBe('')
  })

  it('scanWxml if case 1', () => {
    const wxml = `
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const res = scanWxml(wxml)
    const { code } = handleWxml(res)
    expect(code.trim()).toBe('')
  })

  it('scanWxml if case 2', () => {
    const wxml = `
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const res = scanWxml(wxml, { platform: 'alipay' })
    const { code } = handleWxml(res)
    expect(code.trim()).toBe('<t-divider/>')
  })

  it('scanWxml if case 3', () => {
    const wxml = `
    <!--  #endif -->
     <!--  #ifdef  alipay      -->
    <!--  #ifdef  tt      -->
<t-fab>Auto import</t-fab>
<!--  #endif -->
<t-divider/>
<!--  #endif -->
`
    const res = scanWxml(wxml, { platform: 'alipay' })
    const { code } = handleWxml(res)
    expect(code.trim()).toBe('<t-divider/>')
  })

  it('scanWxml if case 4', () => {
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
    const res = scanWxml(wxml, { platform: 'alipay' })
    const { code } = handleWxml(res)
    expect(code.trim()).toBe('<t-button/>\n\n\n<t-divider/>')
  })

  it('scanWxml if case 5', () => {
    const wxml = `
    <!--  #ifdef  weapp      -->
<t-divider/>
<t-fab>Auto import</t-fab>
<!--  #endif -->
`
    const res = scanWxml(wxml)
    const { removeStartStack, removeEndStack } = res
    const { code } = handleWxml(res)
    expect(removeStartStack).toEqual([])
    expect(removeEndStack).toEqual([90])
    expect(code.trim()).toBe(`<t-divider/>
<t-fab>Auto import</t-fab>`)
  })

  it('scanWxml components case 6', () => {
    const wxml = `  <HelloWorld></HelloWorld>
      <navigation-bar></navigation-bar>`
    const { components } = scanWxml(wxml)
    expect(Object.keys(components).length).toBe(1)
  })

  it('scanWxml import case 0', () => {
    const wxml = `<template name="item">
  <text>{{text}}</text>
</template>`
    const { deps } = scanWxml(wxml)
    expect(deps.length).toBe(0)
  })

  it('scanWxml import case 1', () => {
    const wxml = `<import src="item.wxml"/>
<template is="item" data="{{text: 'forbar'}}"/>
`
    const { deps } = scanWxml(wxml)
    expect(deps.length).toBe(1)
  })

  it('scanWxml import case 2', () => {
    const wxml = `<import src="a.wxml"/>
<template name="B">
  <text> B template </text>
</template>
`
    const { deps } = scanWxml(wxml)
    expect(deps.length).toBe(1)
  })

  it('scanWxml import case 3', () => {
    const wxml = `<import src="b.wxml"/>
<template is="A"/>  <!-- Error! Can not use tempalte when not import A. -->
<template is="B"/>

`
    const { deps } = scanWxml(wxml)
    expect(deps.length).toBe(1)
  })

  it('scanWxml include case 0', () => {
    const wxml = `<include src="header.wxml"/>
<view> body </view>
<include src="footer.wxml"/>
`
    const { deps } = scanWxml(wxml)
    expect(deps.length).toBe(2)
  })
})
