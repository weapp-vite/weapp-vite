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

  it('should keep swan platform styles for #ifdef', async () => {
    const input = `
      /* #ifdef swan */
      .swan-style { color: blue; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'swan')
    expect(result.css).toBe(`
      .swan-style { color: blue; }
    `)
  })

  it('should keep jd platform styles for #ifdef', async () => {
    const input = `
      /* #ifdef jd */
      .jd-style { color: purple; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'jd')
    expect(result.css).toBe(`
      .jd-style { color: purple; }
    `)
  })

  it('should remove swan styles with #ifndef swan when running on swan', async () => {
    const input = `
      /* #ifndef swan */
      .not-swan { color: orange; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'swan')
    expect(result.css.trim()).toBe('')
  })

  it('should remove jd styles with #ifndef jd when running on jd', async () => {
    const input = `
      /* #ifndef jd */
      .not-jd { color: cyan; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'jd')
    expect(result.css.trim()).toBe('')
  })

  it('treats platform directives case-insensitively', async () => {
    const input = `
      /* #ifdef SWAN */
      .upper-swan { color: navy; }
      /* #endif */
    `
    const result = await runPostCSS(input, 'swan')
    expect(result.css).toBe(`
      .upper-swan { color: navy; }
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
