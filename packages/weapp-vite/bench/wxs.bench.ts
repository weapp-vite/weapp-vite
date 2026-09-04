import { describe } from 'vitest'
import { transformWxsCode } from '@/wxs'
import { createWxsFixture, defaultBenchOptions, defineBenchmark } from './utils'

describe('wxs', () => {
  const code = createWxsFixture()

  defineBenchmark(
    'transformWxsCode',
    () => {
      transformWxsCode(code, { filename: 'bench.wxs.ts' })
    },
    {
      ...defaultBenchOptions,
      time: 500,
      iterations: 10,
    },
  )
})
