import { expect, it } from 'vitest'
import { SequenceMeasurements } from './measurement'
import { normalizeSequenceModuleId } from './moduleId'

it.each([
  { repo: '/workspace/repo', fixture: '/workspace/repo/fixture', separator: '/' },
  { repo: 'C:\\workspace\\repo', fixture: 'C:\\workspace\\repo\\fixture', separator: '\\' },
])('preserves virtual identity while normalizing path fields on $separator', ({ repo, fixture, separator }) => {
  const source = `${fixture}${separator}src${separator}page.vue`
  const dependency = `${repo}${separator}packages${separator}runtime.js`
  const virtual = `\0weapp-vite:sidecar:script:${encodeURIComponent(source)}:${encodeURIComponent(dependency)}:module.js`
  expect(normalizeSequenceModuleId(virtual, fixture, repo)).toBe(`\0weapp-vite:sidecar:script:${encodeURIComponent('<fixture>/src/page.vue')}:${encodeURIComponent('<repo>/packages/runtime.js')}:module.js`)
  expect(normalizeSequenceModuleId(`${source}?raw&owner=${encodeURIComponent(source)}&type=style&index=0`, fixture, repo)).toBe(`<fixture>/src/page.vue?raw&owner=${encodeURIComponent('<fixture>/src/page.vue')}&type=style&index=0`)
  expect(normalizeSequenceModuleId('\0virtual:unchanged?value=%2Fnot-a-path-token%ZZ', fixture, repo)).toBe('\0virtual:unchanged?value=%2Fnot-a-path-token%ZZ')
})

it('keeps root boundaries and distinct module counts when external labels collide', () => {
  expect(normalizeSequenceModuleId('/repo/fixture-other/page.vue', '/repo/fixture', '/repo')).toBe('<repo>/fixture-other/page.vue')
  const measurements = new SequenceMeasurements('/fixture')
  measurements.load('/external-a/file.js')
  measurements.load('/external-b/file.js')
  expect(measurements.snapshot().loadedModules).toEqual(['<external>/file.js', '<external>/file.js'])
})
