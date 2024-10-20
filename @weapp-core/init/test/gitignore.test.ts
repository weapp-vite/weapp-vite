import { getDefaultGitignore } from '@/gitignore'

describe('gitignore', () => {
  it('getDefaultGitignore', () => {
    expect(getDefaultGitignore()).toMatchSnapshot()
  })
})
