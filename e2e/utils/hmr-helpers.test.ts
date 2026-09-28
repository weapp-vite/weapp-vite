import { fs } from '@weapp-core/shared/node'
import { describe, expect, it, vi } from 'vitest'
import { parseStatefulHmrControlSource, waitForStatefulHmrControl } from './hmr-helpers'

function createControlSource(url: string) {
  return `globalThis["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"] = ${JSON.stringify({
    buildId: 'build-id',
    token: 'token',
    url,
  })};\nvoid 0;\n`
}

describe('parseStatefulHmrControlSource', () => {
  it('waits for the listening port instead of accepting the initial zero-port publication', async () => {
    const endpoint = 'http://localhost:5173/__weapp_vite_stateful_hmr__'
    const exists = vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const read = vi.spyOn(fs, 'readFile')
      .mockResolvedValueOnce(createControlSource('http://localhost:0/__weapp_vite_stateful_hmr__'))
      .mockResolvedValue(createControlSource(endpoint))
    try {
      await expect(waitForStatefulHmrControl('control.js', 2_000)).resolves.toEqual({ url: endpoint })
      expect(read).toHaveBeenCalledTimes(2)
    }
    finally {
      read.mockRestore()
      exists.mockRestore()
    }
  })

  it.each([
    'http://localhost:5173/__weapp_vite_stateful_hmr__',
    'http://127.0.0.1:5173/__weapp_vite_stateful_hmr__',
    'http://[::1]:5173/__weapp_vite_stateful_hmr__',
  ])('accepts a loopback control URL: %s', (url) => {
    expect(parseStatefulHmrControlSource(createControlSource(url))).toEqual({ url })
  })

  it.each([
    'https://localhost:5173/__weapp_vite_stateful_hmr__',
    'http://example.com:5173/__weapp_vite_stateful_hmr__',
    'http://localhost/__weapp_vite_stateful_hmr__',
    'http://localhost:0/__weapp_vite_stateful_hmr__',
    'http://127.0.0.1:0/__weapp_vite_stateful_hmr__',
    'http://localhost:5173/__weapp_vite_stateful_hmr__/',
    'http://localhost:5173/other',
  ])('rejects an invalid control URL: %s', (url) => {
    expect(parseStatefulHmrControlSource(createControlSource(url))).toBeUndefined()
  })

  it('rejects malformed control source', () => {
    expect(parseStatefulHmrControlSource('globalThis.control = {};')).toBeUndefined()
    expect(parseStatefulHmrControlSource('globalThis["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"] = nope;')).toBeUndefined()
  })
})
