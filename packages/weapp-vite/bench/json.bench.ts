import type { AliasOptions } from '@/types'
import { bench, describe } from 'vitest'
import { analyzeAppJson, analyzeCommonJson } from '@/plugins/utils/analyze'
import { getAliasEntries, parseCommentJson, resolveJson } from '@/utils/json'
import { createJsoncFixture, defaultBenchOptions } from './utils'

describe('json', () => {
  const jsonc = createJsoncFixture()
  const parsed = parseCommentJson(jsonc) as any

  bench(
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

  bench(
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

  bench(
    'analyzeAppJson',
    () => {
      analyzeAppJson(parsed)
    },
    defaultBenchOptions,
  )

  bench(
    'analyzeCommonJson',
    () => {
      analyzeCommonJson(parsed)
    },
    defaultBenchOptions,
  )
})
