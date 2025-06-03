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
})
