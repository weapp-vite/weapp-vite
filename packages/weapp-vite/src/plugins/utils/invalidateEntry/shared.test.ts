import { expect, it } from 'vitest'
import { getWatchedScriptModuleSuffixes, isSidecarFile } from './shared'

it('classifies native JDS sidecars only when the platform owns their script identity', () => {
  expect(getWatchedScriptModuleSuffixes('jd')).toContain('.jds')
  expect(getWatchedScriptModuleSuffixes('weapp')).not.toContain('.jds')
  expect(isSidecarFile('components/format.jds', 'jd')).toBe(true)
  expect(isSidecarFile('components/format.jds', 'weapp')).toBe(false)
  expect(isSidecarFile('components/format.jds')).toBe(false)
  expect(isSidecarFile('components/format.wxs', 'jd')).toBe(true)
})
