import { describe } from 'vitest'
import { handleWxml } from '@/wxml/handle'
import { scanWxml } from '@/wxml/scan'
import { createWxmlFixture, defaultBenchOptions, defineBenchmark } from './utils'

describe('wxml', () => {
  const wxml = createWxmlFixture()

  defineBenchmark(
    'scanWxml (no cache key)',
    () => {
      scanWxml(wxml, {
        platform: 'weapp',
        excludeComponent() {
          return false
        },
      })
    },
    defaultBenchOptions,
  )

  const token = scanWxml(wxml, { platform: 'weapp' })

  defineBenchmark(
    'scanWxml (cache hit)',
    () => {
      scanWxml(wxml, { platform: 'weapp' })
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'handleWxml (warm cache hit)',
    () => {
      handleWxml(token, {
        removeComment: true,
        transformEvent: true,
      })
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'scanWxml + handleWxml (end-to-end)',
    () => {
      const scanned = scanWxml(wxml, {
        platform: 'weapp',
        excludeComponent() {
          return false
        },
      })
      handleWxml(scanned, {
        removeComment: true,
        transformEvent: true,
      })
    },
    {
      ...defaultBenchOptions,
      iterations: 10,
    },
  )
})
