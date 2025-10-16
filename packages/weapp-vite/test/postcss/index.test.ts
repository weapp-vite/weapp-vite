import type { CssPostProcessOptions } from '@/postcss/types'
import postcss from 'postcss'
import { cssPostProcess } from '@/postcss'
import { postCreator } from '@/postcss/post'

describe('postcss', () => {
  it('@weapp-vite-keep-import', async () => {
    const { css } = await postcss([postCreator()]).process('@wv-keep-import', { from: undefined })
    expect(css).toMatchSnapshot()
  })

  it('@weapp-vite-keep-import case 0', async () => {
    const { css } = await postcss([postCreator()]).process('@wv-keep-import \'xxx\'', { from: undefined })
    expect(css).toMatchSnapshot()
  })
})

describe('cssPostProcess', () => {
  it('should return the original code if no @weapp- prefix is found', async () => {
    const code = 'body { color: red; }'
    const options: CssPostProcessOptions = { platform: 'weapp' }
    const result = await cssPostProcess(code, options)
    expect(result).toBe(code)
  })

  it('should process @weapp-keep-import rule correctly', async () => {
    const code = `
      @weapp-keep-import "some-import";
      body { color: red; }
    `
    const options: CssPostProcessOptions = { platform: 'weapp' }
    const result = await cssPostProcess(code, options)
    expect(result).toContain('import "some-import";')
  })

  it('should remove platform-specific styles for a different platform', async () => {
    const code = `
      /* #ifdef h5 */
      body { color: red; }
      /* #endif */
    `
    const options: CssPostProcessOptions = { platform: 'weapp' }
    const result = await cssPostProcess(code, options)
    expect(result).not.toContain('color: red;')
  })

  it('should keep platform-specific styles for the specified platform', async () => {
    const code = `
      /* #ifdef weapp */
      body { color: red; }
      /* #endif */
    `
    const options: CssPostProcessOptions = { platform: 'weapp' }
    const result = await cssPostProcess(code, options)
    expect(result).toContain('color: red;')
  })

  it('should handle nested conditional directives', async () => {
    const code = `
      /* #ifdef weapp */
      .outer { color: black; }
      /* #ifdef alipay */
      .inner { color: blue; }
      /* #endif */
      /* #endif */
    `

    const keepOptions: CssPostProcessOptions = { platform: 'weapp' }
    const keepResult = await cssPostProcess(code, keepOptions)
    expect(keepResult).toContain('.outer')
    expect(keepResult).not.toContain('.inner')

    const removeOptions: CssPostProcessOptions = { platform: 'alipay' }
    const removeResult = await cssPostProcess(code, removeOptions)
    expect(removeResult.replace(/\s+/g, '')).toBe('')
  })

  it('should support swan and jd platform directives', async () => {
    const code = `
      /* #ifdef swan */
      .swan-only { color: blue; }
      /* #endif */
      /* #ifdef jd */
      .jd-only { color: purple; }
      /* #endif */
    `
    const swanResult = await cssPostProcess(code, { platform: 'swan' })
    expect(swanResult).toContain('.swan-only')
    expect(swanResult).not.toContain('.jd-only')

    const jdResult = await cssPostProcess(code, { platform: 'jd' })
    expect(jdResult).toContain('.jd-only')
    expect(jdResult).not.toContain('.swan-only')
  })

  it('should remove #ifndef blocks for swan and jd when targeting those platforms', async () => {
    const code = `
      /* #ifndef swan */
      .not-swan { color: orange; }
      /* #endif */
      /* #ifndef jd */
      .not-jd { color: cyan; }
      /* #endif */
    `
    const swanResult = await cssPostProcess(code, { platform: 'swan' })
    expect(swanResult).not.toContain('.not-swan')
    expect(swanResult).toContain('.not-jd')

    const jdResult = await cssPostProcess(code, { platform: 'jd' })
    expect(jdResult).not.toContain('.not-jd')
    expect(jdResult).toContain('.not-swan')
  })
})
