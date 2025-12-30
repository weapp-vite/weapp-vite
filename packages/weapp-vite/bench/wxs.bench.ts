import { bench, describe } from 'vitest'
import { transformWxsCode } from '@/wxs'
import { createWxsFixture, defaultBenchOptions } from './utils'

describe('wxs', () => {
  const code = createWxsFixture()

  bench(
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
