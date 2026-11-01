import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectAncestorDirectories } from './paths'

describe('project ancestor boundaries', () => {
  it('bounds Windows glob paths by the native project root', () => {
    expect(projectAncestorDirectories('C:\\workspace\\mini-app', 'C:/workspace/mini-app/src/pages/index.wxml', path.win32)).toEqual([
      'C:\\workspace\\mini-app\\src\\pages',
      'C:\\workspace\\mini-app\\src',
      'C:\\workspace\\mini-app',
    ])
  })

  it('uses the configured Windows root identity for case and separator differences', () => {
    expect(projectAncestorDirectories('C:\\Workspace\\mini-app', 'c:/workspace/mini-app/index.wxml', path.win32)).toEqual(['C:\\Workspace\\mini-app'])
    expect(projectAncestorDirectories('\\\\server\\share\\mini-app', '//server/share/mini-app/src/index.wxml', path.win32)).toEqual([
      '\\\\server\\share\\mini-app\\src',
      '\\\\server\\share\\mini-app',
    ])
  })

  it('stops at a POSIX project root and supports a filesystem root project', () => {
    expect(projectAncestorDirectories('/workspace/mini-app', '/workspace/mini-app/src/index.wxml', path.posix)).toEqual(['/workspace/mini-app/src', '/workspace/mini-app'])
    expect(projectAncestorDirectories('/', '/src/index.wxml', path.posix)).toEqual(['/src', '/'])
    expect(projectAncestorDirectories('C:\\', 'C:/index.wxml', path.win32)).toEqual(['C:\\'])
  })

  it('rejects sibling directories, parent directories and other Windows drives', () => {
    for (const file of ['C:/workspace/mini-app-copy/index.wxml', 'C:/workspace/index.wxml', 'D:/workspace/mini-app/index.wxml']) {
      expect(() => projectAncestorDirectories('C:\\workspace\\mini-app', file, path.win32)).toThrow('所属项目内')
    }
    expect(() => projectAncestorDirectories('/workspace/mini-app', '/workspace/mini-app-copy/index.wxml', path.posix)).toThrow('所属项目内')
  })
})
