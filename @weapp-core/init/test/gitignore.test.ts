import { getDefaultGitignore, mergeGitignore } from '@/gitignore'

describe('gitignore', () => {
  it('getDefaultGitignore', () => {
    expect(getDefaultGitignore()).toMatchSnapshot()
  })

  it('mergeGitignore keeps custom entries and dedupes defaults', () => {
    const existing = '# custom\ncustom-dist\nnode_modules\n'
    const merged = mergeGitignore(existing)

    expect(merged).toContain('# custom')
    expect(merged).toContain('custom-dist')
    expect(merged).toContain('node_modules\n\n# dependencies')
    expect(countLine(merged, 'node_modules')).toBe(1)
    expect(merged.endsWith('\n')).toBe(true)
  })

  it('mergeGitignore does not duplicate defaults', () => {
    const defaults = getDefaultGitignore()
    const merged = mergeGitignore(defaults)
    expect(countLine(merged, 'coverage')).toBe(1)
    expect(countLine(merged, '.turbo')).toBe(1)
  })
})

function countLine(input: string, target: string) {
  return input.split('\n').filter(line => line === target).length
}
