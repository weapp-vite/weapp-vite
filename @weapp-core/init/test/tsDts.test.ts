import { getDefaultTsDts } from '@/tsDts'

describe('tsDts', () => {
  it('getDefaultTsDts', () => {
    expect(getDefaultTsDts()).toMatchSnapshot()
  })
})
