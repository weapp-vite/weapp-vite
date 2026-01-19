import { describe, expect, it } from 'vitest'
import { weappWebPlugin } from '../src/plugin'

describe('weappWebPlugin', () => {
  it('transforms wxml files to template modules', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '<view>{{msg}}</view>',
      '/foo/bar.wxml',
    )
    expect(result?.code).toContain(`import { html } from 'lit'`)
    expect(result?.code).toContain('export default render')
  })

  it('transforms wxss files to css injection helpers', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '.page { width: 750rpx; }',
      '/foo/index.wxss',
    )
    expect(result?.code).toContain('injectStyle')
    expect(result?.code).toContain('export function useStyle')
  })
})
