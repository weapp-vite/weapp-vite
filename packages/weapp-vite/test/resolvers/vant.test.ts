import vantJson from '@/auto-import-components/resolvers/json/vant.json'

describe('vant', () => {
  it('vant default', () => {
    expect(vantJson).toMatchSnapshot()
  })
})
