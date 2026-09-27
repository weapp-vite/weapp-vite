import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { rolldown } from 'rolldown'
import { expect, it } from 'vitest'

it('initializes Core and validates/resolves/streams without any dynamic evaluation attempt', async () => {
  const bundle = await rolldown({ input: fileURLToPath(new URL('./probe.ts', import.meta.url)), platform: 'neutral' })
  try {
    const { output } = await bundle.generate({ format: 'iife', name: 'demoProbe' })
    let attempts = 0
    function forbidden() {
      attempts++
      throw new Error('动态求值被禁止')
    }
    const context = vm.createContext({ Function: forbidden, eval: forbidden, console }, { codeGeneration: { strings: false, wasm: false } })
    expect(() => vm.runInContext('new Function("")', context)).toThrow('动态求值被禁止')
    expect(attempts).toBe(1)
    attempts = 0
    vm.runInContext(output[0]!.code, context)
    expect(vm.runInContext('demoProbe.probe()', context)).toBe('兼容检查')
    expect(attempts).toBe(0)
  }
  finally {
    await bundle.close()
  }
})
