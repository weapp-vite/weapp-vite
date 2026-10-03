// @vitest-environment happy-dom

import type { WeappCanvas } from '../src/runtime/nativeComponents/canvas'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'

beforeAll(() => ensureNativeComponentsDefined())
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('native canvas bitmap ownership', () => {
  it('does not reset drawing state for unrelated attributes, repeated dimensions or reconnection', () => {
    const host = document.createElement('weapp-canvas') as WeappCanvas
    host.setAttribute('width', '160')
    host.setAttribute('height', '160')
    document.body.append(host)
    const canvas = host.canvasElement!
    const width = vi.spyOn(canvas, 'width', 'set')
    const height = vi.spyOn(canvas, 'height', 'set')
    host.setAttribute('disable-scroll', '')
    host.setAttribute('canvas-id', 'updated-id')
    host.setAttribute('width', '160')
    host.setAttribute('height', '160')
    host.remove()
    document.body.append(host)
    expect(width).not.toHaveBeenCalled()
    expect(height).not.toHaveBeenCalled()

    host.setAttribute('width', '320')
    expect(width).toHaveBeenCalledExactlyOnceWith(320)
    expect(height).not.toHaveBeenCalled()
  })

  it('preserves direct canvas node sizing until its host size attribute changes', () => {
    const host = document.createElement('weapp-canvas') as WeappCanvas
    document.body.append(host)
    const canvas = host.canvasElement!
    canvas.width = 640
    canvas.height = 480
    host.setAttribute('disable-scroll', '')
    host.remove()
    document.body.append(host)
    expect([canvas.width, canvas.height]).toEqual([640, 480])
    host.setAttribute('width', '200')
    expect([canvas.width, canvas.height]).toEqual([200, 480])
    host.removeAttribute('width')
    expect([canvas.width, canvas.height]).toEqual([300, 480])
  })
})
