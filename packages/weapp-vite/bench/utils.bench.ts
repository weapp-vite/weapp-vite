import { describe } from 'vitest'
import { getCssRealPath, parseRequest } from '@/plugins/utils/parse'
import { changeFileExtension } from '@/utils/file'
import { regExpTest } from '@/utils/regexp'
import { defaultBenchOptions, defineBenchmark } from './utils'

describe('utils', () => {
  defineBenchmark(
    'parseRequest',
    () => {
      parseRequest('/src/pages/index/index.ts?wxss')
    },
    defaultBenchOptions,
  )

  const parsed = parseRequest('/src/pages/index/index.ts?wxss')

  defineBenchmark(
    'getCssRealPath',
    () => {
      getCssRealPath(parsed)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
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

  defineBenchmark(
    'regExpTest',
    () => {
      regExpTest(patterns, '/src/pages/index/index.ts', { exact: false })
    },
    defaultBenchOptions,
  )
})
