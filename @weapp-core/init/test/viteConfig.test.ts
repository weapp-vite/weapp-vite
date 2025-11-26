import { getDefaultViteConfig } from '@/viteConfig'

describe('viteConfig', () => {
  it('getDefaultViteConfig', () => {
    const config = getDefaultViteConfig()
    expect(config).toContain(`import { defineConfig } from 'weapp-vite/config'`)
    expect(config).toContain('export default defineConfig')
  })
})
