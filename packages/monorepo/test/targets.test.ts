import { getTargets } from '@/targets'

describe('targets', () => {
  it('normal', () => {
    const targets = getTargets()
    expect(targets).toMatchSnapshot()
  })

  it('raw', () => {
    const targets = getTargets(true)
    expect(targets).toMatchSnapshot()
  })
})
