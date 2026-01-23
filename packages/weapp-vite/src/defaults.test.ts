import { describe, expect, it } from 'vitest'
import { getWeappViteConfig } from './defaults'

describe('getWeappViteConfig', () => {
  it('defaults hmr.sharedChunks to auto', () => {
    const config = getWeappViteConfig()
    expect(config.hmr?.sharedChunks).toBe('auto')
  })

  it('defaults hmr.touchAppWxss to auto', () => {
    const config = getWeappViteConfig()
    expect(config.hmr?.touchAppWxss).toBe('auto')
  })
})
