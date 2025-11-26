import { getDefaultGitignore, __internal as gitignoreInternal, mergeGitignore } from '@/gitignore'

function countLine(input: string, target: string) {
  return input.split('\n').filter(line => line === target).length
}

describe('gitignore', () => {
  it('exposes default gitignore template', () => {
    const result = getDefaultGitignore()
    expect(result).toContain('# dependencies')
    expect(result).toContain('.turbo')
    expect(result.split('\n')[0]).toBe('# dependencies')
  })

  it('mergeGitignore keeps custom entries and normalizes blanks', () => {
    const existing = '# custom\r\ncustom-dist\r\n\r\n'
    const merged = mergeGitignore(existing)

    expect(merged).not.toContain('\r')
    expect(merged).toContain('# custom')
    expect(merged).toContain('custom-dist')
    expect(countLine(merged, 'custom-dist')).toBe(1)
    expect(merged.endsWith('\n')).toBe(true)
    expect(merged.includes('\n\n\n')).toBe(false)
  })

  it('mergeGitignore dedupes defaults and trims trailing blanks', () => {
    const defaults = `${getDefaultGitignore()}\n\n`
    const merged = mergeGitignore(defaults)
    expect(countLine(merged, 'coverage')).toBe(1)
    expect(countLine(merged, '.turbo')).toBe(1)
    expect(merged.endsWith('\n')).toBe(true)
  })

  it('ensureTrailingNewline keeps trailing newline untouched', () => {
    const value = 'line\n'
    expect(gitignoreInternal.ensureTrailingNewline(value)).toBe(value)
  })
})
