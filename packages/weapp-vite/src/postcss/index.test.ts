import { describe, expect, it } from 'vitest'
import { cssPostProcess } from './index'

describe('cssPostProcess', () => {
  it('lowers Vue deep selectors in final WeChat CSS', async () => {
    const result = await cssPostProcess(`
.host :deep() .child,
:deep(.dialog:not(:last-child)) {
  color: red;
}
    `.trim(), { platform: 'weapp' })

    expect(result).toContain('.host')
    expect(result).toContain('.child')
    expect(result).toContain('.dialog:not(:last-child)')
    expect(result).not.toContain(':deep')
  })

  it('lowers legacy v-deep and mapped HTML selectors in final WeChat CSS', async () => {
    const result = await cssPostProcess(`
.markdown ::v-deep h2,
::v-deep .code-block {
  color: red;
}
    `.trim(), { platform: 'weapp' })

    expect(result).toContain('.markdown .h2')
    expect(result).toContain('.code-block')
    expect(result).not.toContain('::v-deep')
    expect(result).not.toMatch(/(^|[\s,])h2(?=[\s,{])/)
  })

  it('keeps Vue deep selectors on non-WeChat platforms', async () => {
    const source = '.host :deep(.child) { color: red; }'

    await expect(cssPostProcess(source, { platform: 'alipay' })).resolves.toBe(source)
  })

  it('recognizes uni-app platform defines after Sass import expansion', async () => {
    const result = await cssPostProcess(`
/* #ifdef MP-WEIXIN */
:host { --theme-color: green; }
/* #endif */
/* #ifndef MP-WEIXIN */
:root, page, body, [data-theme='dark'] { --theme-color: red; }
/* #endif */
    `.trim(), { platform: 'weapp' })

    expect(result).toContain(':host { --theme-color: green; }')
    expect(result).not.toContain(':root')
    expect(result).not.toContain('[data-theme')
    expect(result).not.toContain('#ifdef')
    expect(result).not.toContain('#ifndef')
  })

  it('flattens nested CSS variable fallbacks for WXSS', async () => {
    const result = await cssPostProcess(
      '.wd-action-sheet-wrapper__popup { border-radius: var(--wot-action-sheet-radius, var(--wot-radius-large, var(--wot-n-8, 8px))); }',
      { platform: 'weapp' },
    )

    expect(result).toContain('border-radius: var(--wot-action-sheet-radius, 8px)')
    expect(result).not.toContain('var(--wot-radius-large')
    expect(result).not.toContain('var(--wot-n-8')
  })
})
