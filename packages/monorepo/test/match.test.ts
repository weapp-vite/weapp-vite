import mm from 'micromatch'

describe('match', () => {
  it('workspace case 0', () => {
    expect(mm.isMatch('packages', ['packages/*'])).toBe(false)
  })
})
