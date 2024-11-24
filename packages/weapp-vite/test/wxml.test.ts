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
})
