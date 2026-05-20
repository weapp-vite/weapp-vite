import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSidecarWatchOptions } from './options'

describe('runtime sidecar watch options', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

  it('inherits polling options from chokidar environment variables', () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
    vi.stubEnv('CHOKIDAR_INTERVAL', '120')
    vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '240')

    expect(createSidecarWatchOptions({ inlineConfig: {} } as any, {
      persistent: true,
    })).toEqual({
      persistent: true,
      usePolling: true,
      interval: 120,
      binaryInterval: 240,
    })
  })
})
