import { describe, expect, it, vi } from 'vitest'
import { renderDiagram } from './render'

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaid }))

describe('Mermaid render ownership', () => {
  it('keeps a diagram configuration active until its render completes', async () => {
    let finish!: (value: { svg: string }) => void
    mermaid.render.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
      .mockResolvedValueOnce({ svg: '<svg>dark</svg>' })
    const light = renderDiagram('light', 'graph TD; A-->B', { theme: 'default' })
    const dark = renderDiagram('dark', 'graph TD; B-->C', { theme: 'dark' })

    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1))
    expect(mermaid.initialize.mock.calls).toEqual([[{ theme: 'default' }]])
    finish({ svg: '<svg>light</svg>' })
    await expect(light).resolves.toEqual({ svg: '<svg>light</svg>' })
    await expect(dark).resolves.toEqual({ svg: '<svg>dark</svg>' })
    expect(mermaid.initialize).toHaveBeenLastCalledWith({ theme: 'dark' })
  })

  it('continues rendering later diagrams after a parse failure', async () => {
    mermaid.render.mockRejectedValueOnce(new Error('invalid diagram'))
      .mockResolvedValueOnce({ svg: '<svg>valid</svg>' })
    await expect(renderDiagram('invalid', 'invalid', {})).rejects.toThrow('invalid diagram')
    await expect(renderDiagram('valid', 'graph TD; A-->B', {})).resolves.toEqual({ svg: '<svg>valid</svg>' })
  })
})
