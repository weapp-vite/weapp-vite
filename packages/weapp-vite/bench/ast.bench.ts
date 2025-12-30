import { parseSync } from 'oxc-parser'
import { bench, describe } from 'vitest'
import { collectRequireTokens } from '@/plugins/utils/ast'
import { createJsFixtureForOxc, defaultBenchOptions } from './utils'

describe('oxc parser + require token walk', () => {
  const source = createJsFixtureForOxc()

  bench(
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

  bench(
    'collectRequireTokens (walk only)',
    () => {
      collectRequireTokens(program)
    },
    defaultBenchOptions,
  )
})
