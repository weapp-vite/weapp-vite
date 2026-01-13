import { describe, expect, it, vi } from 'vitest'
import { addMutationRecorder, mutationRecorders, removeMutationRecorder } from '@/reactivity/reactive/mutation'
import { bumpAncestorVersions, bumpRawVersion, getRawVersion, recordParentLink, resolvePathToTarget } from '@/reactivity/reactive/patchState'

describe('reactivity: patch state helpers', () => {
  it('tracks mutation recorders', () => {
    const recorder = vi.fn()
    addMutationRecorder(recorder)
    expect(mutationRecorders.has(recorder)).toBe(true)
    removeMutationRecorder(recorder)
    expect(mutationRecorders.has(recorder)).toBe(false)
  })

  it('resolves paths for unique parents', () => {
    const root = {}
    const child = {}
    recordParentLink(child, root, 'child')

    expect(resolvePathToTarget(root, child)).toEqual(['child'])
  })

  it('returns undefined path for multi-parent nodes', () => {
    const parentA = {}
    const parentB = {}
    const child = {}
    recordParentLink(child, parentA, 'a')
    recordParentLink(child, parentB, 'b')

    expect(resolvePathToTarget(parentA, child)).toBeUndefined()
  })

  it('bumps versions for ancestors', () => {
    const root = {}
    const child = {}
    recordParentLink(child, root, 'child')

    bumpRawVersion(root)
    expect(getRawVersion(root)).toBe(1)
    bumpAncestorVersions(child)
    expect(getRawVersion(root)).toBe(2)
  })
})
