import { processWxml } from '@/utils/wxml'
// https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html
describe('wxml', () => {
  it('processWxml case bind', () => {
    const { code } = processWxml('<view @tap="hello"></view>')
    expect(code).toBe('<view bind:tap="hello"></view>')
  })

  it('processWxml case catch', () => {
    const { code } = processWxml('<view @tap.catch="hello"></view>')
    expect(code).toBe('<view catch:tap="hello"></view>')
  })

  it('processWxml case mut-bind', () => {
    const { code } = processWxml('<view @tap.mut="hello"></view>')
    expect(code).toBe('<view mut-bind:tap="hello"></view>')
  })

  it('processWxml case capture-bind', () => {
    const { code } = processWxml('<view @tap.capture="hello"></view>')
    expect(code).toBe('<view capture-bind:tap="hello"></view>')
  })

  it('processWxml case capture-catch', () => {
    const { code } = processWxml('<view @tap.capture.catch="hello"></view>')
    expect(code).toBe('<view capture-catch:tap="hello"></view>')
    const { code: code1 } = processWxml('<view @tap.catch.capture="hello"></view>')
    expect(code1).toBe('<view capture-catch:tap="hello"></view>')
  })
})
