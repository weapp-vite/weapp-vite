import { bench, describe } from 'vitest'
import { getCssRealPath, parseRequest } from '@/plugins/utils/parse'
import { changeFileExtension } from '@/utils/file'
import { regExpTest } from '@/utils/regexp'
import { defaultBenchOptions } from './utils'

describe('utils', () => {
  bench(
    'parseRequest',
    () => {
      parseRequest('/src/pages/index/index.ts?wxss')
    },
    defaultBenchOptions,
  )

  const parsed = parseRequest('/src/pages/index/index.ts?wxss')

  bench(
    'getCssRealPath',
    () => {
      getCssRealPath(parsed)
    },
    defaultBenchOptions,
  )

  bench(
    'changeFileExtension',
    () => {
      changeFileExtension('/src/pages/index/index.ts', 'wxml')
    },
    defaultBenchOptions,
  )

  const patterns = [
    'node_modules',
    /[\\/]dist[\\/]/,
    /\.(png|jpe?g|gif|webp)$/i,
    'pages/index',
    /pages\/(.*)\/(index|home)/,
  ]

  bench(
    'regExpTest',
    () => {
      regExpTest(patterns, '/src/pages/index/index.ts', { exact: false })
    },
    defaultBenchOptions,
  )
})
