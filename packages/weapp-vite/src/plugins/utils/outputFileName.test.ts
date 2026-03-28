import { describe, expect, it } from 'vitest'
import {
  resolveRelativeJsonOutputFileName,
  resolveRelativeOutputFileName,
  resolveRelativeOutputFileNameWithExtension,
} from './outputFileName'

describe('output file name helpers', () => {
  const configService = {
    relativeOutputPath(filePath: string) {
      return filePath.replace('/project/src/', '')
    },
  }

  it('resolves a relative output file name from source path', () => {
    expect(resolveRelativeOutputFileName(
      configService as any,
      '/project/src/pages/home/index.vue',
    )).toBe('pages/home/index.vue')
  })

  it('changes the relative output file extension after resolving path', () => {
    expect(resolveRelativeOutputFileNameWithExtension(
      configService as any,
      '/project/src/pages/home/index.ts',
      '.js',
    )).toBe('pages/home/index.js')
  })

  it('removes trailing js extension before resolving json output file name', () => {
    expect(resolveRelativeJsonOutputFileName(
      configService as any,
      '/project/src/pages/home/index.json.js',
    )).toBe('pages/home/index.json')
  })
})
