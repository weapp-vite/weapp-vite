import { bench, describe } from 'vitest'
import { handleWxml } from '@/wxml/handle'
import { scanWxml } from '@/wxml/scan'
import { createWxmlFixture, defaultBenchOptions } from './utils'

describe('wxml', () => {
  const wxml = createWxmlFixture()

  bench(
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

  bench(
    'scanWxml (cache hit)',
    () => {
      scanWxml(wxml, { platform: 'weapp' })
    },
    defaultBenchOptions,
  )

  bench(
    'handleWxml (warm cache hit)',
    () => {
      handleWxml(token, {
        removeComment: true,
        transformEvent: true,
      })
    },
    defaultBenchOptions,
  )

  bench(
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
