import { removeExtension, removeExtensionDeep } from '@/index'

describe('removeExtension', () => {
  it('should remove all extensions from a file name', () => {
    expect(removeExtension('file.txt')).toBe('file')
    expect(removeExtension('document.pdf')).toBe('document')
    expect(removeExtension('archive.tar.gz')).toBe('archive.tar')

    expect(removeExtensionDeep('file.txt')).toBe('file')
    expect(removeExtensionDeep('document.pdf')).toBe('document')
    expect(removeExtensionDeep('archive.tar.gz')).toBe('archive')
  })

  it('should return the same file name if there is no extension', () => {
    expect(removeExtension('file')).toBe('file')
    expect(removeExtension('document')).toBe('document')
  })

  it('should handle hidden files correctly', () => {
    // expect(removeExtension('.hiddenfile')).toBe('.hiddenfile')
    expect(removeExtension('.hiddenfile.txt')).toBe('.hiddenfile')
  })

  it('should handle file names with multiple dots', () => {
    expect(removeExtension('my.file.name.txt')).toBe('my.file.name')
    expect(removeExtension('my.file.name')).toBe('my.file')

    expect(removeExtensionDeep('my.file.name.txt')).toBe('my')
    expect(removeExtensionDeep('my.file.name')).toBe('my')
  })

  it('should handle file names with multiple dots 0', () => {
    expect(removeExtension('my.wxs.ts')).toBe('my.wxs')
    expect(removeExtension('my.wxs.js')).toBe('my.wxs')
    expect(removeExtension('my.wxs')).toBe('my')

    expect(removeExtensionDeep('my.wxs.ts')).toBe('my')
    expect(removeExtensionDeep('my.wxs.js')).toBe('my')
    expect(removeExtensionDeep('my.wxs')).toBe('my')
    expect(removeExtensionDeep('xx/yy/my.wxs')).toBe('xx/yy/my')

    expect(removeExtensionDeep('./my.wxs')).toBe('./my')
  })

  it('should handle empty string', () => {
    expect(removeExtension('')).toBe('')
  })

  // it('should handle strings with only an extension', () => {
  //   expect(removeExtension('.gitignore')).toBe('.gitignore')
  // })
})
