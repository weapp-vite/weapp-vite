// @vitest-environment happy-dom

import type { WeappCanvas } from '../src/runtime/nativeComponents/canvas'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createCanvasContextBridge } from '../src/runtime/polyfill/canvasContext'
import { createSelectorQueryBridge } from '../src/runtime/polyfill/selectorQuery'

beforeAll(() => ensureNativeComponentsDefined())
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('native canvas bitmap ownership', () => {
  it('returns the drawable canvas node while retaining host layout fields', () => {
    const host = document.createElement('weapp-canvas') as WeappCanvas
    host.id = 'signature'
    host.dataset.role = 'signature-pad'
    host.setAttribute('canvas-id', 'legacy-signature')
    document.body.append(host)
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      bottom: 130,
      height: 100,
      left: 20,
      right: 220,
      top: 30,
      width: 200,
    } as DOMRect)
    const canvas = host.canvasElement!
    const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' }
    vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const fieldsCallback = vi.fn()
    const nodeCallback = vi.fn()
    const query = createSelectorQueryBridge()
    query.select('#signature').fields({ dataset: true, id: true, node: true, rect: true, size: true }, fieldsCallback)
    query.select('#signature').node(nodeCallback)
    query.exec()

    const fields = fieldsCallback.mock.calls[0]![0]
    expect(fields).toMatchObject({
      bottom: 130,
      dataset: { role: 'signature-pad' },
      height: 100,
      id: 'signature',
      left: 20,
      right: 220,
      top: 30,
      width: 200,
    })
    expect(fields.node).toBe(canvas)
    expect(nodeCallback.mock.calls[0]![0].node).toBe(canvas)
    fields.node.width = 600
    fields.node.height = 300
    fields.node.getContext('2d').fillRect(10, 10, 40, 40)
    expect(context.fillRect).toHaveBeenCalledExactlyOnceWith(10, 10, 40, 40)

    const legacy = createCanvasContextBridge('legacy-signature')
    legacy.setFillStyle('#559242')
    legacy.fillRect(1, 2, 3, 4)
    legacy.draw(true)
    expect(context.fillStyle).toBe('#559242')
    expect(context.fillRect).toHaveBeenLastCalledWith(1, 2, 3, 4)
    host.setAttribute('disable-scroll', '')
    expect([canvas.width, canvas.height]).toEqual([600, 300])
  })

  it('resolves scoped and multiple canvas nodes by host identity despite duplicate ids', () => {
    const scopes = [document.createElement('section'), document.createElement('section')]
    const canvases = scopes.map((scope) => {
      const host = document.createElement('weapp-canvas') as WeappCanvas
      host.id = 'signature'
      scope.append(host)
      document.body.append(scope)
      return host.canvasElement!
    })
    const scoped = vi.fn()
    createSelectorQueryBridge().in(scopes[0]).select('#signature').node(scoped).exec()
    expect(scoped).toHaveBeenCalledWith({ node: canvases[0] })
    const multiple = vi.fn()
    createSelectorQueryBridge().selectAll('#signature').fields({ node: true }, multiple).exec()
    expect(multiple).toHaveBeenCalledWith(canvases.map(node => ({ node })))
  })

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
