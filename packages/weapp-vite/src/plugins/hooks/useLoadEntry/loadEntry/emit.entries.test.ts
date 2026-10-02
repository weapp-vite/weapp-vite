import type { Entry } from '../../../../types'
import type { ExtendedLibManager } from '../extendedLib'
import { describe, expect, it } from 'vitest'
import { prepareNormalizedEntries } from './emit'

describe('entry metadata ownership', () => {
  it.each(['page', 'component'] as const)('preserves loaded %s metadata when a parent declares it again', (type) => {
    const child = {
      type,
      path: '/project/src/child.ts',
      jsonPath: '/project/src/child.json',
      templatePath: '/project/src/child.wxml',
      json: { usingComponents: { card: '/components/card' } },
      declaredJson: {},
    } as Entry
    const entriesMap = new Map<string, Entry | undefined>([['child', child]])
    const normalized = prepareNormalizedEntries({
      entries: ['child', 'new-child'],
      json: { pages: ['child', 'new-child'] },
      jsonPath: '/project/src/app.json',
      templatePath: '',
      id: '/project/src/app.ts',
      entriesMap,
      normalizeEntry: entry => entry,
      extendedLibManager: { shouldIgnoreEntry: () => false } as unknown as ExtendedLibManager,
      explicitEntryTypes: new Map([['child', type]]),
    })
    expect(normalized).toEqual(['child', 'new-child'])
    expect(entriesMap.get('child')).toEqual(child)
    expect(entriesMap.get('new-child')?.type).toBe('page')
  })
})
