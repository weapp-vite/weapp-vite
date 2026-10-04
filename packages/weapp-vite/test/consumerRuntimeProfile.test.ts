import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCaseInventory } from '../../../e2e/scripts/domAcceptanceReport/inventoryAnalyzer'
import { createConsumerRuntimeProfile } from '../scripts/consumerRuntimeProfile.mjs'

const repository = path.resolve(import.meta.dirname, '../../..')
const profiles = ['stateful', 'classic', 'classic-watch', 'react', 'independent', 'worker', 'plugin', 'lib', 'platform']

describe('consumer runtime selection declared before execution', () => {
  it.each(profiles)('selects exactly the declared source cases for %s across providers and hosts', (profile) => {
    for (const provider of ['headless', 'devtools']) {
      for (const host of ['wv', 'vite', 'vite-plus']) {
        if (profile === 'classic-watch' && host === 'wv') {
          continue
        }
        const selected = createConsumerRuntimeProfile(profile, host, provider)
        const inventory = readCaseInventory(repository, selected.file).map(item => ({ file: selected.file, name: item.name }))
        const runtimeInventory = profile.startsWith('classic')
          ? [inventory[0]!].map(item => ({ ...item, name: item.name.replace(/^wv /, `${host}${profile === 'classic-watch' ? '-watch' : ''} `) }))
          : inventory
        const pattern = new RegExp(selected.testNamePattern)
        expect(runtimeInventory.filter(item => pattern.test(item.name))).toEqual(expect.arrayContaining(selected.cases))
        expect(runtimeInventory.filter(item => pattern.test(item.name))).toHaveLength(selected.cases.length)
        expect(selected.cases.every(item => pattern.test(item.name.replaceAll(' > ', ' ')))).toBe(true)
        expect(selected.cases.every(item => item.file === selected.file)).toBe(true)
      }
    }
  })

  it('keeps headless stateful scope and disabled plugin mode explicit', () => {
    expect(createConsumerRuntimeProfile('stateful', 'vite-plus', 'headless').cases).toHaveLength(3)
    expect(createConsumerRuntimeProfile('stateful', 'vite-plus', 'devtools').cases).toHaveLength(4)
    const plugin = createConsumerRuntimeProfile('plugin', 'vite-plus', 'devtools')
    expect(plugin.cases).toHaveLength(2)
    expect(plugin.cases.every(item => item.name.includes('ES6: disabled'))).toBe(true)
    expect(new RegExp(plugin.testNamePattern).test(plugin.cases[0]!.name.replace('disabled', 'enabled'))).toBe(false)
  })

  it('rejects unsupported profiles and standalone watch before launch', () => {
    expect(() => createConsumerRuntimeProfile('web', 'vite', 'headless')).toThrow('Unsupported consumer runtime profile')
    expect(() => createConsumerRuntimeProfile('classic-watch', 'wv', 'headless')).toThrow('Standalone classic consumer')
    expect(() => createConsumerRuntimeProfile('stateful', 'other', 'headless')).toThrow('Unsupported runtime compiler host')
    expect(() => createConsumerRuntimeProfile('stateful', 'wv', 'other')).toThrow('Unsupported runtime provider')
  })
})
