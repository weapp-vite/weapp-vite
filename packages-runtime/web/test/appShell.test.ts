import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureAppContainer,
  getAppContainer,
  onDocumentReady,
} from '../src/runtime/appShell/container'

const originalDocument = (globalThis as Record<string, unknown>).document

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Record<string, unknown>).document
  }
  else {
    Object.assign(globalThis, { document: originalDocument })
  }
})

describe('app shell container helpers', () => {
  it('returns undefined when document is unavailable', () => {
    delete (globalThis as Record<string, unknown>).document
    expect(getAppContainer()).toBeUndefined()
    expect(ensureAppContainer()).toBeUndefined()
  })

  it('reuses an existing app container or creates one in the body', () => {
    const children: any[] = []
    const documentRef = {
      readyState: 'complete',
      body: { append: (node: unknown) => children.push(node) },
      querySelector: (selector: string) => selector === '#app' ? children[0] ?? null : null,
      createElement: () => ({ setAttribute: (name: string, value: string) => ({ name, value }) }),
      addEventListener: () => {},
    }
    Object.assign(globalThis, { document: documentRef })

    const container = ensureAppContainer() as any
    expect(container).toBe(children[0])
    expect(ensureAppContainer()).toBe(container)
    expect(getAppContainer()).toBe(container)
  })

  it('runs immediately for ready documents and waits for DOMContentLoaded while loading', () => {
    const callbacks: Array<() => void> = []
    const documentRef = {
      readyState: 'loading',
      addEventListener: (_name: string, callback: () => void) => callbacks.push(callback),
    }
    Object.assign(globalThis, { document: documentRef })
    const callback = () => {}

    onDocumentReady(callback)
    expect(callbacks).toEqual([callback])

    documentRef.readyState = 'complete'
    onDocumentReady(callback)
  })
})
