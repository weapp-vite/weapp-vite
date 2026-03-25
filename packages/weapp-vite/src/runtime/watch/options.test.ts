import { describe, expect, it } from 'vitest'
import { createSidecarWatchOptions } from './options'

describe('runtime sidecar watch options', () => {
  it('keeps base options when polling is not configured', () => {
    expect(createSidecarWatchOptions({ inlineConfig: {} } as any, {
      persistent: true,
      ignoreInitial: true,
    })).toEqual({
      persistent: true,
      ignoreInitial: true,
    })
  })

  it('inherits polling options from build.watch.chokidar', () => {
    expect(createSidecarWatchOptions({
      inlineConfig: {
        build: {
          watch: {
            chokidar: {
              usePolling: true,
              interval: 100,
              binaryInterval: 200,
            },
          },
        },
      },
    } as any, {
      persistent: true,
    })).toEqual({
      persistent: true,
      usePolling: true,
      interval: 100,
      binaryInterval: 200,
    })
  })
})
