import tdesignJson from '@/auto-import-components/resolvers/json/tdesign.json'

describe('tdesign', () => {
  it('tdesign default', () => {
    expect(tdesignJson).toMatchSnapshot()
  })
})
