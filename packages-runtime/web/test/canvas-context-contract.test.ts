import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerNativeMediaElement,
  unregisterNativeMediaElement,
} from '../src/runtime/nativeComponents/mediaRegistry'
import { createCanvasContextBridge } from '../src/runtime/polyfill/canvasContext'

function createRuntimeContext() {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    fillStyle: '',
    font: '',
    lineCap: 'butt',
    lineWidth: 0,
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D
}

describe('canvas context bridge contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finishes safely when the document, id, canvas, or context is unavailable', () => {
    const done = vi.fn()

    vi.stubGlobal('document', undefined)
    createCanvasContextBridge('missing').draw(done)
    expect(done).toHaveBeenCalledTimes(1)

    const querySelectorAll = vi.fn(() => [])
    vi.stubGlobal('document', { querySelectorAll })
    createCanvasContextBridge('   ').draw()
    expect(querySelectorAll).not.toHaveBeenCalled()

    vi.stubGlobal('document', {
      body: {
        querySelectorAll: vi.fn(() => [null, {
          getAttribute: vi.fn(() => null),
          id: 'other',
        }]),
      },
    })
    createCanvasContextBridge('missing').draw()

    vi.stubGlobal('document', {})
    createCanvasContextBridge('missing').draw()

    vi.stubGlobal('document', {
      querySelectorAll: vi.fn(() => [{
        getAttribute: vi.fn(() => 'target'),
        getContext: vi.fn(() => null),
        id: 'other',
      }]),
    })
    createCanvasContextBridge('target').draw()
  })

  it('resolves registered canvases and normalizes invalid drawing values', () => {
    vi.stubGlobal('document', {})
    const context = createRuntimeContext()
    const canvas = {
      getContext: vi.fn(() => context),
      height: Number.NaN,
      width: 'invalid',
    } as unknown as HTMLCanvasElement
    registerNativeMediaElement('canvas', ['registered'], canvas)
    const done = vi.fn()

    try {
      const api = createCanvasContextBridge('registered')
      api.setLineWidth(Number.NaN)
      api.setFontSize(Number.NaN)
      api.clearRect(Number.NaN, undefined as unknown as number, null as unknown as number, '4' as unknown as number)
      api.fillText(null as unknown as string, Number.NaN, Number.NaN, 120)
      api.arc(1, 2, -3, 4, 5, true)
      api.draw(false, done)

      expect(context.clearRect).toHaveBeenNthCalledWith(1, 0, 0, 0, 0)
      expect(context.clearRect).toHaveBeenNthCalledWith(2, 0, 0, 0, 0)
      expect(context.fillText).toHaveBeenCalledWith('', 0, 0, 120)
      expect(context.arc).toHaveBeenCalledWith(1, 2, 0, 4, 5, true)
      expect(context.lineWidth).toBe(0)
      expect(context.font).toBe('1px sans-serif')
      expect(done).toHaveBeenCalledTimes(1)
    }
    finally {
      unregisterNativeMediaElement(canvas)
    }
  })

  it('finds a canvas by id and supports a non-finite max width', () => {
    const context = createRuntimeContext()
    const canvas = {
      getAttribute: vi.fn(() => null),
      getContext: vi.fn(() => context),
      id: 'by-id',
      height: 20,
      width: 30,
    }
    vi.stubGlobal('document', {
      querySelectorAll: vi.fn(() => [canvas]),
    })

    const api = createCanvasContextBridge('by-id')
    api.fillText('text', 1, 2, Number.POSITIVE_INFINITY)
    api.draw(true)

    expect(context.clearRect).not.toHaveBeenCalled()
    expect(context.fillText).toHaveBeenCalledWith('text', 1, 2)
  })

  it('normalizes a null canvas id', () => {
    const querySelectorAll = vi.fn(() => [])
    vi.stubGlobal('document', { querySelectorAll })

    createCanvasContextBridge(null as unknown as string).draw()

    expect(querySelectorAll).not.toHaveBeenCalled()
  })
})
