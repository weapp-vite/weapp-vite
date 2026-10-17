import { describe, expect, it } from 'vitest'
import { normalizeComponentPath } from './index'

describe('normalizeComponentPath', () => {
  it.each([
    '/components/subject/index.js',
    'components\\subject\\index.wxml',
    './components/subject/../subject/index.json',
  ])('normalizes mini-program root and relative paths: %s', (componentPath) => {
    expect(normalizeComponentPath(componentPath)).toBe('components/subject/index')
  })

  it.each([
    '',
    '.',
    '..',
    '../components/index',
    'nested/../../components/index',
    'C:\\components\\index',
    'C:/components/index',
    'C:components/index',
    '/C:/components/index',
    './C:/components/index',
    'nested/../C:/components/index',
    'C:/../components/index',
  ])('rejects traversal and Windows drive paths: %s', (componentPath) => {
    expect(() => normalizeComponentPath(componentPath)).toThrow('artifact root')
  })
})
