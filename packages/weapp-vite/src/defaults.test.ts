import { describe, expect, it } from 'vitest'
import { getWeappViteConfig } from './defaults'

describe('getWeappViteConfig', () => {
  it('defaults hmr.sharedChunks to full', () => {
    const config = getWeappViteConfig()
    expect(config.hmr?.sharedChunks).toBe('full')
  })
})
