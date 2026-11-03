import type { Fixture } from './types'
import { FEATURE_COHORTS } from './contracts'

export function cohorts(fixtures: Fixture[]): Array<[string, Fixture[]]> {
  const real = fixtures.filter(file => !file.synthetic)
  const shared = real.filter(file => file.cohort === 'shared')
  const wxml = real.filter(file => file.cohort === 'wxml')
  const groups: Array<[string, Fixture[]]> = [
    ['shared', shared],
    ...(['small', 'medium', 'large'] as const).map(size => [`shared-${size}`, shared.filter(file => file.size === size)] as [string, Fixture[]]),
    ...FEATURE_COHORTS.map(feature => [`shared-${feature}`, shared.filter(file => file.features?.includes(feature))] as [string, Fixture[]]),
    ['wxml', wxml],
    ['wxml-script', wxml.filter(file => file.features?.includes('script'))],
    ...fixtures.filter(file => file.synthetic).map(file => [file.pressureId!, [file]] as [string, Fixture[]]),
    ['real-all', real],
  ]
  return groups.filter(([, files]) => files.length > 0)
}
