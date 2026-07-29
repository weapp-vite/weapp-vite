import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRuntimeClipboard,
  getRuntimeDialogs,
  getRuntimeFetch,
  getRuntimeStorage,
  getWebRuntimeHost,
  openRuntimeUrl,
  resetWebRuntimeHost,
  setWebRuntimeHost,
} from '../src/runtime/host'
import { readClipboardData, writeClipboardData } from '../src/runtime/polyfill/interaction'
import { performRequestByFetch } from '../src/runtime/polyfill/network/request'
import {
  getStorageSyncInternal,
  setStorageSyncInternal,
} from '../src/runtime/polyfill/storage'
import { resolveModalSelection } from '../src/runtime/polyfill/ui'

describe('web runtime host adapter', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
  })

  it('uses injected host primitives without mutating the global environment', () => {
    const fetch = vi.fn(async () => new Response('{}'))
    const storage = {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    }
    const clipboard = {
      readText: vi.fn(async () => 'copied'),
      writeText: vi.fn(async () => undefined),
    }
    const dialogs = {
      alert: vi.fn(),
      confirm: vi.fn(() => true),
      prompt: vi.fn(() => 'value'),
    }
    const open = vi.fn()

    setWebRuntimeHost({ fetch, storage, clipboard, dialogs, open })

    expect(getWebRuntimeHost()).toEqual({ fetch, storage, clipboard, dialogs, open })
    expect(getRuntimeFetch()).toBe(fetch)
    expect(getRuntimeStorage()).toBe(storage)
    expect(getRuntimeClipboard()).toBe(clipboard)
    expect(getRuntimeDialogs()).toBe(dialogs)
    expect(openRuntimeUrl('/preview', '_blank')).toBeUndefined()
    expect(open).toHaveBeenCalledWith('/preview', '_blank')
  })

  it('resets the adapter to browser fallback resolution', () => {
    const fetch = vi.fn(async () => new Response('{}'))
    setWebRuntimeHost({ fetch })
    expect(getRuntimeFetch()).toBe(fetch)

    resetWebRuntimeHost()

    expect(getWebRuntimeHost()).toEqual({})
    expect(getRuntimeFetch()).not.toBe(fetch)
  })

  it('resolves browser globals and forwards optional open features', () => {
    const fetch = vi.fn()
    const storage = { getItem: vi.fn() }
    const clipboard = { readText: vi.fn() }
    const alert = vi.fn()
    const confirm = vi.fn()
    const prompt = vi.fn()
    const open = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('navigator', { clipboard })
    vi.stubGlobal('alert', alert)
    vi.stubGlobal('confirm', confirm)
    vi.stubGlobal('prompt', prompt)
    vi.stubGlobal('window', { open })

    setWebRuntimeHost(undefined)
    expect(getRuntimeFetch()).toBe(fetch)
    expect(getRuntimeStorage()).toBe(storage)
    expect(getRuntimeClipboard()).toBe(clipboard)
    expect(getRuntimeDialogs()).toEqual({ alert, confirm, prompt })
    openRuntimeUrl('/global', '_blank', 'noopener')
    expect(open).toHaveBeenCalledWith('/global', '_blank', 'noopener')

    const hostOpen = vi.fn()
    setWebRuntimeHost({ open: hostOpen })
    openRuntimeUrl('/host', '_self', 'popup')
    expect(hostOpen).toHaveBeenCalledWith('/host', '_self', 'popup')
    vi.unstubAllGlobals()
  })

  it('falls back to a global open function when window is absent', () => {
    const open = vi.fn()
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('open', open)
    openRuntimeUrl('/global-only', '_blank')
    expect(open).toHaveBeenCalledWith('/global-only', '_blank')
  })

  it('routes runtime I/O bridges through the injected host', async () => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    }))
    const clipboard = {
      readText: vi.fn(async () => 'from-host'),
      writeText: vi.fn(async () => undefined),
    }
    const confirm = vi.fn(() => false)
    setWebRuntimeHost({ fetch, clipboard, dialogs: { confirm } })

    await writeClipboardData('to-host')
    await expect(readClipboardData()).resolves.toBe('from-host')
    expect(clipboard.writeText).toHaveBeenCalledWith('to-host')
    expect(clipboard.readText).toHaveBeenCalledTimes(1)

    setStorageSyncInternal('host-key', { enabled: true })
    expect(getStorageSyncInternal('host-key')).toEqual({ enabled: true })

    await expect(performRequestByFetch({ url: '/host', dataType: 'json' })).resolves.toMatchObject({
      data: { ok: true },
      statusCode: 200,
    })
    expect(fetch).toHaveBeenCalledWith('/host', expect.objectContaining({ method: 'GET' }))
    expect(resolveModalSelection({ title: 'Host', content: 'confirm?' })).toEqual({ confirm: false, cancel: true })
    expect(confirm).toHaveBeenCalledWith('Host\n\nconfirm?')
  })
})
