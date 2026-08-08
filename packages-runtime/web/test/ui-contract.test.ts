// @vitest-environment happy-dom

import { WEAPP_VITE_WEB_ACTION_SHEET_SELECT_INDEX_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  getGlobalDialogHandlers,
  getLoadingElement,
  getToastElement,
  hideToastElement,
  normalizeActionSheetItems,
  resolveActionSheetSelection,
  resolveModalSelection,
  resolveToastPrefix,
  setLoadingVisible,
  setToastVisible,
} from '../src/runtime/polyfill/ui'

describe('web UI capability contracts', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('creates, reuses, shows and hides toast elements', () => {
    const toast = getToastElement()!
    expect(toast.getAttribute('hidden')).toBe('true')
    expect(getToastElement()).toBe(toast)

    setToastVisible(toast, true)
    expect(toast.hasAttribute('hidden')).toBe(false)
    expect(toast.style.opacity).toBe('1')
    setToastVisible(toast, false)
    expect(toast.getAttribute('hidden')).toBe('true')
    expect(toast.style.opacity).toBe('0')
    hideToastElement()

    expect(resolveToastPrefix('none')).toBe('')
    expect(resolveToastPrefix('error')).toBe('[error] ')
    expect(resolveToastPrefix('success')).toBe('[ok] ')
    expect(resolveToastPrefix(undefined)).toBe('[ok] ')
  })

  it('handles missing document and body toast hosts', () => {
    const originalDocument = document
    vi.stubGlobal('document', undefined)
    expect(getToastElement()).toBeUndefined()
    expect(hideToastElement()).toBeUndefined()

    vi.stubGlobal('document', {
      querySelector: () => null,
      createElement: () => originalDocument.createElement('div'),
      body: null,
    })
    expect(getToastElement()).toBeUndefined()
  })

  it('creates, reuses and styles loading elements for mask variants', () => {
    const loading = getLoadingElement()!
    expect(getLoadingElement()).toBe(loading)
    setLoadingVisible(loading, true, 'Loading', true)
    expect(loading.textContent).toBe('Loading')
    expect(loading.style.pointerEvents).toBe('auto')
    expect(loading.style.boxShadow).toContain('99999px')

    setLoadingVisible(loading, false, '', false)
    expect(loading.getAttribute('hidden')).toBe('true')
    expect(loading.style.pointerEvents).toBe('none')
    expect(loading.style.boxShadow).toBe('none')
  })

  it('handles missing document and body loading hosts', () => {
    vi.stubGlobal('document', undefined)
    expect(getLoadingElement()).toBeUndefined()

    const createElement = vi.fn(() => ({ setAttribute: vi.fn() }))
    vi.stubGlobal('document', {
      querySelector: () => null,
      createElement,
      body: null,
    })
    expect(getLoadingElement()).toBeUndefined()
    expect(createElement).not.toHaveBeenCalled()
  })

  it('resolves action sheet function, numeric, prompt and fallback selections', () => {
    vi.stubGlobal(WEAPP_VITE_WEB_ACTION_SHEET_SELECT_INDEX_KEY, (items: string[]) => items.length - 1)
    expect(resolveActionSheetSelection(['a', 'b'])).toBe(1)

    vi.stubGlobal(WEAPP_VITE_WEB_ACTION_SHEET_SELECT_INDEX_KEY, () => -1)
    setWebRuntimeHost({ dialogs: { prompt: () => '1' } })
    expect(resolveActionSheetSelection(['a', 'b'])).toBe(1)

    vi.stubGlobal(WEAPP_VITE_WEB_ACTION_SHEET_SELECT_INDEX_KEY, 0)
    expect(resolveActionSheetSelection(['a', 'b'])).toBe(0)
    vi.stubGlobal(WEAPP_VITE_WEB_ACTION_SHEET_SELECT_INDEX_KEY, 4)
    setWebRuntimeHost({ dialogs: { prompt: () => null } })
    expect(resolveActionSheetSelection(['a', 'b'])).toBeNull()

    setWebRuntimeHost({ dialogs: { prompt: () => 'invalid' } })
    expect(resolveActionSheetSelection(['a', 'b'])).toBe(0)
    setWebRuntimeHost({ dialogs: {} })
    expect(resolveActionSheetSelection(['a', 'b'])).toBe(0)
  })

  it('resolves modal confirmation with host dialogs and empty messages', () => {
    const confirm = vi.fn(() => false)
    const alert = vi.fn()
    setWebRuntimeHost({ dialogs: { confirm, alert } })
    expect(getGlobalDialogHandlers()).toEqual({ confirm, alert })
    expect(resolveModalSelection({ title: ' Title ', content: ' Content ' })).toEqual({
      confirm: false,
      cancel: true,
    })
    expect(confirm).toHaveBeenCalledWith('Title\n\nContent')

    expect(resolveModalSelection({ title: ' ', content: ' ', showCancel: false })).toEqual({
      confirm: true,
      cancel: false,
    })
    expect(alert).toHaveBeenCalledWith(' ')

    setWebRuntimeHost({ dialogs: {} })
    expect(resolveModalSelection()).toEqual({ confirm: true, cancel: false })
    expect(resolveModalSelection({ showCancel: false })).toEqual({ confirm: true, cancel: false })
  })

  it('normalizes action sheet item collections', () => {
    expect(normalizeActionSheetItems(null)).toEqual([])
    expect(normalizeActionSheetItems([' first ', null, 2, '', false])).toEqual(['first', '2', 'false'])
  })
})
