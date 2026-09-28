import { readFileSync } from 'node:fs'
import path from 'node:path'
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

it('loads the native package without evaluation and registers each precompiled component once', () => {
  let attempts = 0
  let registrations = 0
  function forbidden() {
    attempts++
    throw new Error('动态求值被禁止')
  }
  const context = vm.createContext({
    Function: forbidden,
    eval: forbidden,
    console,
    setTimeout,
    clearTimeout,
    Component() { registrations++ },
  }, { codeGeneration: { strings: false, wasm: false } })
  const directory = fileURLToPath(new URL('../../../packages-runtime/json-render-components/dist/miniprogram/', import.meta.url))
  const cache = new Map<string, { exports: unknown }>()
  function load(file: string): unknown {
    const cached = cache.get(file)
    if (cached) {
      return cached.exports
    }
    const module = { exports: {} }
    cache.set(file, module)
    const run = vm.runInContext(`(function(exports, require, module) {\n${readFileSync(file, 'utf8')}\n})`, context)
    run(module.exports, (request: string) => {
      expect(request.startsWith('.')).toBe(true)
      return load(path.resolve(path.dirname(file), request))
    }, module)
    return module.exports
  }
  load(path.join(directory, 'renderer/index.js'))
  load(path.join(directory, 'fallback/index.js'))
  expect(registrations).toBe(2)
  expect(attempts).toBe(0)
})
