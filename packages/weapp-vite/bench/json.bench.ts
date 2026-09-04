import type { AliasOptions } from '@/types'
import { describe } from 'vitest'
import { analyzeAppJson, analyzeCommonJson } from '@/plugins/utils/analyze'
import { getAliasEntries, parseCommentJson, resolveJson } from '@/utils/json'
import { createJsoncFixture, defaultBenchOptions, defineBenchmark } from './utils'

describe('json', () => {
  const jsonc = createJsoncFixture()
  const parsed = parseCommentJson(jsonc) as any

  defineBenchmark(
    'parseCommentJson (jsonc)',
    () => {
      parseCommentJson(jsonc)
    },
    {
      ...defaultBenchOptions,
      time: 500,
      iterations: 10,
    },
  )

  const aliasOptions: AliasOptions = {
    entries: {
      '@': '/abs/src',
    },
  }
  const aliasEntries = getAliasEntries(aliasOptions)

  defineBenchmark(
    'resolveJson (usingComponents + aliases)',
    () => {
      resolveJson(
        {
          json: parsed,
          jsonPath: '/abs/src/app.json',
          type: 'app',
        },
        aliasEntries,
      )
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'analyzeAppJson',
    () => {
      analyzeAppJson(parsed)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'analyzeCommonJson',
    () => {
      analyzeCommonJson(parsed)
    },
    defaultBenchOptions,
  )
})
