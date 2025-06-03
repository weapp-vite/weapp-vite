import type { MpPlatform } from '@/types'
import postcss from 'postcss'
import { postCreator } from '@/postcss/post'

function runPostCSS(input: string, platform: MpPlatform) {
  const plugin = postCreator({ platform })
  return postcss([plugin]).process(input, { from: undefined })
}

describe('postCreator Plugin', () => {
  it('should replace custom @rules correctly', async () => {
    const input = `
      @wv-keep-import "some.css";
    `
    const result = await runPostCSS(input, 'weapp')
    expect(result.css).toBe(`
      @import "some.css";
    `)
  })

  it('should keep platform-specific styles for #ifdef', async () => {
    const input = `
      /* #ifdef weapp */
      .weapp-style { color: red; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'weapp')
    expect(result.css).toBe(`
      .weapp-style { color: red; }
    `)
  })

  it('should remove non-matching platform styles for #ifdef', async () => {
    const input = `
      /* #ifdef alipay */
      .alipay-style { color: blue; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'weapp')
    expect(result.css.trim()).toBe('')
  })

  it('should remove matching platform styles for #ifndef', async () => {
    const input = `
      /* #ifndef weapp */
      .not-weapp-style { color: green; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'weapp')
    expect(result.css.trim()).toBe('')
  })

  it('should keep non-matching platform styles for #ifndef', async () => {
    const input = `
      /* #ifndef alipay */
      .not-alipay-style { color: green; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'weapp')
    expect(result.css).toBe(`
      .not-alipay-style { color: green; }
    `)
  })

  it('atRule @wv-if case 0', async () => {
    const input = `
      @wv-if (weapp) and (tt){
        .not-alipay-style { color: green; }
      }
    `
    const result = await runPostCSS(input, 'alipay')
    expect(result.css.trim()).toBe(``)
  })

  it('atRule @wv-if case 1', async () => {
    const input = `
      @wv-if (weapp) and (tt){
        .not-alipay-style { color: green; }
      }
    `
    const result = await runPostCSS(input, 'tt')
    expect(result.css.trim()).toBe(`.not-alipay-style { color: green; }`)
  })
})
