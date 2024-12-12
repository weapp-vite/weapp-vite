import type { MpPlatform } from '@/types'
import { postCreator } from '@/postcss/post'
import postcss from 'postcss'

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
})
