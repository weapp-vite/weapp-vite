import { describe, expect, it } from 'vitest'
import { createStatefulHmrControlSource, statefulHmrRolldownRuntimeSource } from './runtimeSource'

describe('stateful hmr runtime source', () => {
  it('uses static runtime hooks without dynamic evaluation', () => {
    expect(statefulHmrRolldownRuntimeSource).toContain('class WeappViteDevRuntime extends BaseDevRuntime')
    expect(statefulHmrRolldownRuntimeSource).toContain('Page(definition) { return registerDefinition(\'Page\', definition); }')
    expect(statefulHmrRolldownRuntimeSource).not.toContain('globalThis[name] = function')
    expect(statefulHmrRolldownRuntimeSource).toContain('!runtime.applyingPatch && runtime.patchedModules.has(moduleId)')
    expect(statefulHmrRolldownRuntimeSource).toContain('installNative(name, registration)')
    expect(statefulHmrRolldownRuntimeSource).toContain('takeNativeDefinitions(name)')
    expect(statefulHmrRolldownRuntimeSource).toContain('if (name === \'Component\')')
    expect(statefulHmrRolldownRuntimeSource).toContain('this.registrationModuleId = id')
    expect(statefulHmrRolldownRuntimeSource).toContain('runtime.currentModuleId || runtime.registrationModuleId || name')
    expect(statefulHmrRolldownRuntimeSource).toContain('result.onLoad = function (...args)')
    expect(statefulHmrRolldownRuntimeSource).toContain('result.onUnload = function (...args)')
    expect(statefulHmrRolldownRuntimeSource).toContain('methods[name] = function (...args)')
    expect(statefulHmrRolldownRuntimeSource).toContain('refreshWevuInstance(this, moduleId)')
    expect(statefulHmrRolldownRuntimeSource).toContain('wevuRefreshGenerations.set(moduleId')
    expect(statefulHmrRolldownRuntimeSource).toContain('runtime.registrationModuleId || runtime.currentModuleId || \'Component\'')
    expect(statefulHmrRolldownRuntimeSource.indexOf('!runtime.applyingPatch && runtime.patchedModules.has(moduleId)')).toBeLessThan(
      statefulHmrRolldownRuntimeSource.indexOf('wevuRefreshes.set(moduleId, refresh)'),
    )
    expect(statefulHmrRolldownRuntimeSource).toContain('original.call(globalThis, decorateObject(definition, moduleId))')
    expect(statefulHmrRolldownRuntimeSource).not.toMatch(/\beval\s*\(|new\s+Function|\bFunction\s*\(/)
  })

  it('renders authenticated metadata transport without executable HTTP payloads', () => {
    const source = createStatefulHmrControlSource({
      buildId: 'build-a',
      token: 'token-a',
      url: 'http://127.0.0.1:1234/__weapp_vite_stateful_hmr__',
    })
    expect(source).toContain('build-a')
    expect(source).toContain('token-a')
    expect(source).toContain('send(\'register\')')
    expect(source).toContain('send(\'rebuild\')')
    expect(source).toContain('getVersion() { return version; }')
    expect(source).not.toMatch(/\beval\s*\(|new\s+Function|\bFunction\s*\(/)
  })
})
