import { afterEach, describe, expect, it } from 'vitest'
import { injectStyle, removeStyle } from '../src/runtime/style'

const originalDocument = (globalThis as Record<string, unknown>).document

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Record<string, unknown>).document
  }
  else {
    Object.assign(globalThis, { document: originalDocument })
  }
})

function createDocument() {
  const styles: Array<{ id: string, textContent: string, remove: () => void }> = []
  return {
    styles,
    createElement: () => {
      const style = {
        id: '',
        textContent: '',
        remove: () => {
          const index = styles.indexOf(style)
          if (index >= 0) {
            styles.splice(index, 1)
          }
        },
      }
      styles.push(style)
      return style
    },
    head: {
      append: () => {},
    },
  }
}

describe('runtime style injection', () => {
  it('returns a no-op cleanup when the document is unavailable', () => {
    delete (globalThis as Record<string, unknown>).document
    expect(() => injectStyle('.missing {}')()).not.toThrow()
  })

  it('creates and removes deterministic style elements', () => {
    const documentRef = createDocument()
    Object.assign(globalThis, { document: documentRef })

    const cleanup = injectStyle('.card {}')
    expect(documentRef.styles).toHaveLength(1)
    expect(documentRef.styles[0]?.textContent).toBe('.card {}')

    const updatedCleanup = injectStyle('.card { color: red; }')
    expect(documentRef.styles).toHaveLength(2)
    expect(documentRef.styles[1]?.textContent).toContain('red')

    cleanup()
    expect(documentRef.styles).toHaveLength(1)
    updatedCleanup()
    expect(documentRef.styles).toHaveLength(0)
    removeStyle('missing')
  })

  it('supports explicit ids and replaces an existing style in place', () => {
    const documentRef = createDocument()
    Object.assign(globalThis, { document: documentRef })

    injectStyle('.first {}', 'shared')
    const cleanup = injectStyle('.second {}', 'shared')
    expect(documentRef.styles).toHaveLength(1)
    expect(documentRef.styles[0]?.id).toBe('shared')
    expect(documentRef.styles[0]?.textContent).toBe('.second {}')
    cleanup()
    expect(documentRef.styles).toHaveLength(0)
  })
})
