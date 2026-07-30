import type { MiniProgramEmissionSource, MiniProgramNode } from '@mpcore/test'
import { describe, expect, it } from 'vitest'
import { mpcoreTest, registerMpcoreMatchers } from './index'

describe('@mpcore/vitest', () => {
  it('appends its setup module without replacing user setup files', () => {
    const plugin = mpcoreTest()
    const config = plugin.config({
      test: { setupFiles: ['./existing.ts'] },
    })

    expect(config.test.setupFiles[0]).toBe('./existing.ts')
    expect(config.test.setupFiles[1]).toMatch(/setup\.mjs$/)
  })

  it('registers mini-program matchers explicitly', () => {
    registerMpcoreMatchers()
    const node = {
      dataset: { kind: 'counter' },
      getAttribute(name: string) {
        return name === 'data-kind' ? 'counter' : undefined
      },
      get isConnected() {
        return true
      },
      textContent: 'count: 2',
    } as MiniProgramNode
    const emissions: MiniProgramEmissionSource = {
      emitted: eventName => eventName === 'change' ? [{ value: 2 }] : [],
    }

    expect(node).toBeInTheMiniProgram()
    expect(node).toHaveTextContent('count: 2')
    expect(node).toHaveAttribute('data-kind', 'counter')
    expect(node).toHaveDataset({ kind: 'counter' })
    expect(emissions).toHaveEmitted('change', { value: 2 })
  })
})
