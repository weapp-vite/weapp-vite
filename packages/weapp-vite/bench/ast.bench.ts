import { parseSync } from 'oxc-parser'
import { describe } from 'vitest'
import { collectRequireTokens } from '@/plugins/utils/ast'
import { createJsFixtureForOxc, defaultBenchOptions, defineBenchmark } from './utils'

describe('oxc parser + require token walk', () => {
  const source = createJsFixtureForOxc()

  defineBenchmark(
    'oxc parseSync',
    () => {
      parseSync('bench.ts', source)
    },
    {
      ...defaultBenchOptions,
      time: 500,
      iterations: 10,
    },
  )

  const parsed = parseSync('bench.ts', source)
  const program = parsed.program

  defineBenchmark(
    'collectRequireTokens (walk only)',
    () => {
      collectRequireTokens(program)
    },
    defaultBenchOptions,
  )
})
