import { afterAll, beforeAll, bench, describe } from 'vitest'
import { _collectAutoRouteCandidates } from '@/runtime/autoRoutesPlugin'
import { createAutoRoutesFixture, defaultBenchOptions } from './utils'

describe('auto routes', () => {
  let absoluteSrcRoot = ''
  let cleanup: undefined | (() => Promise<void>)

  beforeAll(async () => {
    const fixture = await createAutoRoutesFixture()
    absoluteSrcRoot = fixture.absoluteSrcRoot
    cleanup = fixture.cleanup
  })

  afterAll(async () => {
    await cleanup?.()
  })

  bench(
    'collectCandidates (filesystem)',
    async () => {
      await _collectAutoRouteCandidates(absoluteSrcRoot)
    },
    {
      ...defaultBenchOptions,
      time: 800,
      iterations: 5,
    },
  )
})
