import { describe, expect, it } from 'vitest'
import {
  resolveComponentLibraryRuntimeMode,
  selectComponentLibraryScenarios,
  shouldCaptureComponentLibraryScreenshot,
  shouldRecoverComponentLibrarySession,
  shouldRotateComponentLibrarySession,
} from './runtimePolicy'

const scenarios = [
  { component: 'first', route: '/first', expectedState: 'pass' },
  { component: 'second', route: '/second', expectedState: 'pass' },
  { component: 'third', route: '/third', expectedState: 'pass' },
]

describe('component library runtime policy', () => {
  it('defaults unknown modes to runtime coverage', () => {
    expect(resolveComponentLibraryRuntimeMode(undefined)).toBe('runtime')
    expect(resolveComponentLibraryRuntimeMode('unknown')).toBe('runtime')
  })

  it('keeps full runtime and visual modes distinct', () => {
    expect(selectComponentLibraryScenarios(scenarios, 'runtime', ['first'])).toEqual(scenarios)
    expect(selectComponentLibraryScenarios(scenarios, 'visual', ['first', 'third'])).toEqual([
      scenarios[0],
      scenarios[2],
    ])
    expect(selectComponentLibraryScenarios(scenarios, 'visual-full', ['first'])).toEqual(scenarios)
  })

  it('captures and rotates only visual sessions', () => {
    expect(shouldCaptureComponentLibraryScreenshot('runtime')).toBe(false)
    expect(shouldCaptureComponentLibraryScreenshot('visual')).toBe(true)
    expect(shouldRotateComponentLibrarySession('runtime', 20, 20)).toBe(false)
    expect(shouldRotateComponentLibrarySession('visual', 20, 20)).toBe(true)
    expect(shouldRotateComponentLibrarySession('visual', 19, 20)).toBe(false)
  })

  it('recovers a session only for infrastructure failures', () => {
    expect(shouldRecoverComponentLibrarySession(Object.assign(new Error('capture timeout'), {
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method: 'App.captureScreenshot',
    }))).toBe(true)
    expect(shouldRecoverComponentLibrarySession(new Error('wechat/up-button: diffRatio=0.4'))).toBe(false)
  })
})
