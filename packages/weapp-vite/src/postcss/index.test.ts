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

  it('keeps Vue deep selectors on non-WeChat platforms', async () => {
    const source = '.host :deep(.child) { color: red; }'

    await expect(cssPostProcess(source, { platform: 'alipay' })).resolves.toBe(source)
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
