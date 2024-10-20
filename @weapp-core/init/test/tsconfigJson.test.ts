import { getDefaultTsconfigJson, getDefaultTsconfigNodeJson } from '@/tsconfigJson'

describe('tsconfigJson', () => {
  it('getDefaultTsconfigJson', () => {
    expect(getDefaultTsconfigJson()).toMatchSnapshot()
  })

  it('getDefaultTsconfigNodeJson', () => {
    expect(getDefaultTsconfigNodeJson([])).toMatchSnapshot()
  })
})
