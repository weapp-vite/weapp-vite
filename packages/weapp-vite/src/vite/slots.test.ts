import type { Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import { createPluginSlots } from './slots'

describe('createPluginSlots', () => {
  it('delegates subpackage naming hooks in the native Vite host', () => {
    const slots = createPluginSlots(() => true)
    const plugin: Plugin = {
      name: 'weapp-vite:subpackage-output',
      enforce: 'post',
      outputOptions(output) {
        return output
      },
    }
    slots.bind([plugin])
    expect(slots.plugins.find(slot => slot.name === plugin.name)?.outputOptions).toBe(plugin.outputOptions)
  })

  it('accepts the built-in WASM initializer plugin', () => {
    const slots = createPluginSlots(() => true)
    const wasmPlugin: Plugin = {
      name: 'weapp-vite:wasm-init',
      enforce: 'pre',
    }

    expect(() => slots.bind([wasmPlugin])).not.toThrow()
    expect(slots.plugins.find(plugin => plugin.name === wasmPlugin.name)).toMatchObject({
      name: wasmPlugin.name,
      enforce: wasmPlugin.enforce,
    })
  })

  it('rejects a WASM initializer with an incompatible enforce phase', () => {
    const slots = createPluginSlots(() => true)

    expect(() => slots.bind([{
      name: 'weapp-vite:wasm-init',
      enforce: 'post',
    }])).toThrow(/插件槽不匹配/u)
  })
})
