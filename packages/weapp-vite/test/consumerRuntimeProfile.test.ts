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
        expect(selected.cases.every(item => pattern.test(item.name.replaceAll(' > ', ' ')))).toBe(false)
        expect(selected.cases.every(item => item.file === selected.file)).toBe(true)
      }
    }
  })

  it('keeps the explicit stateful request on the installed startup-classic scenario for both providers', () => {
    for (const provider of ['headless', 'devtools']) {
      const profile = createConsumerRuntimeProfile('stateful', 'vite-plus', provider)
      expect(profile.projectVariable).toBe('WEAPP_VITE_E2E_STARTUP_CLASSIC_PROJECT')
      expect(profile.cases).toEqual([{
        file: 'e2e/ide/hmr-startup-fallback.runtime.test.ts',
        name: 'vite-plus stateful-experimental compiler capability startup fallback > starts in classic and keeps functional edits, source restoration and config reload in classic',
      }])
      expect(new RegExp(profile.testNamePattern).test(profile.cases[0]!.name.replace('stateful-experimental', 'auto'))).toBe(false)
      expect(new RegExp(profile.testNamePattern).test(profile.cases[0]!.name.replace('vite-plus', 'vite'))).toBe(false)
    }
  })

  it('keeps disabled plugin mode explicit', () => {
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

describe('vite-plus stateful-experimental compiler capability startup fallback', () => {
  it('starts in classic and keeps functional edits, source restoration and config reload in classic', () => {
    const selected = createConsumerRuntimeProfile('stateful', 'vite-plus', 'headless')
    expect(new RegExp(selected.testNamePattern).test(expect.getState().currentTestName!)).toBe(true)
  })
})
