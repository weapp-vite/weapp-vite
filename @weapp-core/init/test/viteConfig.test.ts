import { getDefaultViteConfig } from '@/viteConfig'

describe('viteConfig', () => {
  it('getDefaultViteConfig', () => {
    expect(getDefaultViteConfig()).toMatchSnapshot()
  })
})
