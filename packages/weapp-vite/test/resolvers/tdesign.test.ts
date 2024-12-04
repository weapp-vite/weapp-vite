import { TDesignResolver } from '@/auto-import-components/resolvers/tdesign'

describe('tdesign', () => {
  it('tdesign default', () => {
    expect(TDesignResolver()).toMatchSnapshot()
  })
})
