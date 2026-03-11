import { describe, expect, it } from 'vitest'
import {
  checkPayloadSize,
  collapsePayload,
  estimateJsonSize,
  mergeSiblingPayload,
} from '@/runtime/app/setData/payload'

describe('runtime: setData payload helpers', () => {
  it('returns the original payload when collapse input has zero or one key', () => {
    const empty = {}
    const single = { ready: true }

    expect(collapsePayload(empty)).toBe(empty)
    expect(collapsePayload(single)).toBe(single)
  })

  it('collapses nested payload keys while keeping unrelated siblings', () => {
    const payload = collapsePayload({
      'user.profile.name': 'alice',
      'user.profile.age': 18,
      'user': { profile: { name: 'alice', age: 18 } },
      'userStats.total': 3,
      'banner.visible': true,
    })

    expect(payload).toEqual({
      'user': { profile: { name: 'alice', age: 18 } },
      'userStats.total': 3,
      'banner.visible': true,
    })
  })

  it('estimates json size across primitive, array, object and circular values', () => {
    const circular: any = { ok: true }
    circular.self = circular
    const limitedArray = ['1234', '5678']
    const symbolValue = Symbol('token')

    expect(estimateJsonSize('abc', 10, new WeakSet())).toBe(5)
    expect(estimateJsonSize(null, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(1, 10, new WeakSet())).toBe(1)
    expect(estimateJsonSize(Number.POSITIVE_INFINITY, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(true, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(false, 10, new WeakSet())).toBe(5)
    expect(estimateJsonSize(undefined, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(() => {}, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(symbolValue, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize(10n, 10, new WeakSet())).toBe(4)
    expect(estimateJsonSize([1, 2], 100, new WeakSet())).toBeGreaterThan(2)
    expect(estimateJsonSize({ a: 1 }, 100, new WeakSet())).toBeGreaterThan(2)
    expect(estimateJsonSize(circular, 100, new WeakSet())).toBeGreaterThan(4)
    expect(estimateJsonSize(limitedArray, 5, new WeakSet())).toBeGreaterThan(5)
    expect(estimateJsonSize('abc', 0, new WeakSet())).toBe(1)
  })

  it('checks payload size with estimation, precise stringify fallback, and stringify failure fallback', () => {
    expect(checkPayloadSize({ a: 1 }, Number.POSITIVE_INFINITY)).toEqual({
      fallback: false,
      estimatedBytes: undefined,
      bytes: undefined,
    })

    const oversized = checkPayloadSize({ a: '1234567890' }, 5)
    expect(oversized.fallback).toBe(true)
    expect(oversized.estimatedBytes).toBeGreaterThan(5)

    const nearLimit = checkPayloadSize({ a: '1234', b: '5678', c: '90' }, 20)
    expect(nearLimit.estimatedBytes).toBeDefined()

    const belowStringifyThreshold = checkPayloadSize({ a: '1234', b: '5678' }, 24)
    expect(belowStringifyThreshold.fallback).toBe(false)
    expect(belowStringifyThreshold.bytes).toBeUndefined()

    const withBigInt = checkPayloadSize({ a: 1, b: 2, c: 10n }, 22)
    expect(withBigInt.fallback).toBe(false)
    expect(withBigInt.estimatedBytes).toBeGreaterThanOrEqual(22)
    expect(withBigInt.bytes).toBeUndefined()
  })

  it('merges sibling payloads only when thresholds and heuristics allow it', () => {
    const entryMap = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>([
      ['user.name', { kind: 'property', op: 'set' }],
      ['user.age', { kind: 'property', op: 'set' }],
      ['items.0', { kind: 'array', op: 'set' }],
      ['items.1', { kind: 'array', op: 'set' }],
      ['settings.theme', { kind: 'property', op: 'delete' }],
    ])
    const plainByPath = new Map<string, any>([
      ['user', { name: 'alice', age: 18 }],
      ['items', [1, 2]],
      ['settings', { theme: 'dark' }],
    ])
    const getPlainByPath = (path: string) => plainByPath.get(path)

    const merged = mergeSiblingPayload({
      input: {
        'user.name': 'alice',
        'user.age': 18,
        'items.0': 1,
        'items.1': 2,
        'settings.theme': null,
      },
      entryMap,
      getPlainByPath,
      mergeSiblingThreshold: 2,
      mergeSiblingSkipArray: true,
      mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
      mergeSiblingMaxInflationRatio: Number.POSITIVE_INFINITY,
    })

    expect(merged.merged).toBe(1)
    expect(merged.out).toEqual({
      'user': { name: 'alice', age: 18 },
      'items.0': 1,
      'items.1': 2,
      'settings.theme': null,
    })

    const blockedByInflation = mergeSiblingPayload({
      input: {
        'user.name': 'alice',
        'user.age': 18,
      },
      entryMap,
      getPlainByPath,
      mergeSiblingThreshold: 2,
      mergeSiblingSkipArray: false,
      mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
      mergeSiblingMaxInflationRatio: 0.1,
    })
    expect(blockedByInflation.merged).toBe(0)
    expect(blockedByInflation.out).toEqual({
      'user.name': 'alice',
      'user.age': 18,
    })
  })

  it('skips sibling merging for small groups, dotless keys, deletes, existing parents, and oversized parents', () => {
    const entryMap = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>([
      ['profile.name', { kind: 'property', op: 'set' }],
      ['profile.age', { kind: 'property', op: 'set' }],
      ['profile.title', { kind: 'property', op: 'set' }],
      ['settings', { kind: 'property', op: 'set' }],
      ['profile.remove', { kind: 'property', op: 'delete' }],
    ])
    const plainByPath = new Map<string, any>([
      ['profile', { name: 'alice', age: 18, title: 'dev' }],
    ])

    expect(mergeSiblingPayload({
      input: { 'profile.name': 'alice' },
      entryMap,
      getPlainByPath: path => plainByPath.get(path),
      mergeSiblingThreshold: 0,
      mergeSiblingSkipArray: false,
      mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
      mergeSiblingMaxInflationRatio: Number.POSITIVE_INFINITY,
    })).toEqual({
      out: { 'profile.name': 'alice' },
      merged: 0,
    })

    const preserved = mergeSiblingPayload({
      input: {
        'profile': { name: 'keep-me' },
        'profile.name': 'alice',
        'profile.age': 18,
        'settings': true,
        'profile.remove': null,
      },
      entryMap,
      getPlainByPath: path => plainByPath.get(path),
      mergeSiblingThreshold: 2,
      mergeSiblingSkipArray: false,
      mergeSiblingMaxParentBytes: 1,
      mergeSiblingMaxInflationRatio: Number.POSITIVE_INFINITY,
    })

    expect(preserved.merged).toBe(0)
    expect(preserved.out).toEqual({
      'profile': { name: 'keep-me' },
      'profile.name': 'alice',
      'profile.age': 18,
      'settings': true,
      'profile.remove': null,
    })

    expect(mergeSiblingPayload({
      input: {
        'profile.name': 'alice',
        'profile.age': 18,
      },
      entryMap,
      getPlainByPath: path => plainByPath.get(path),
      mergeSiblingThreshold: 3,
      mergeSiblingSkipArray: false,
      mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
      mergeSiblingMaxInflationRatio: Number.POSITIVE_INFINITY,
    })).toEqual({
      out: {
        'profile.name': 'alice',
        'profile.age': 18,
      },
      merged: 0,
    })
  })

  it('reuses parent cache and skips merging when the parent key is already present', () => {
    const sharedProfile = { name: 'alice', age: 18 }
    const plainByPath = new Map<string, any>([
      ['profile', sharedProfile],
      ['other', sharedProfile],
    ])
    const entryMap = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>([
      ['profile.name', { kind: 'property', op: 'set' }],
      ['profile.age', { kind: 'property', op: 'set' }],
      ['other.name', { kind: 'property', op: 'set' }],
      ['other.age', { kind: 'property', op: 'set' }],
    ])

    const merged = mergeSiblingPayload({
      input: {
        'profile': sharedProfile,
        'profile.name': 'alice',
        'profile.age': 18,
        'other.name': 'alice',
        'other.age': 18,
      },
      entryMap,
      getPlainByPath: path => plainByPath.get(path),
      mergeSiblingThreshold: 2,
      mergeSiblingSkipArray: false,
      mergeSiblingMaxParentBytes: Number.POSITIVE_INFINITY,
      mergeSiblingMaxInflationRatio: Number.POSITIVE_INFINITY,
    })

    expect(merged.merged).toBe(1)
    expect(merged.out).toEqual({
      'profile': sharedProfile,
      'profile.name': 'alice',
      'profile.age': 18,
      'other': sharedProfile,
    })
  })
})
