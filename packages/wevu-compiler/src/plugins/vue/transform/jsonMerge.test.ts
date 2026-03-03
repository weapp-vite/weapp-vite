import { describe, expect, it } from 'vitest'
import { createJsonMerger, mergeJsonWithStrategy } from './jsonMerge'

describe('jsonMerge helpers', () => {
  it('uses strategy function return object when provided', () => {
    const merged = mergeJsonWithStrategy(
      { a: 1 },
      { b: 2 },
      (_base, _incoming, ctx) => {
        return {
          stage: ctx.stage,
          file: ctx.filename,
        }
      },
      {
        filename: '/project/src/pages/index/index.vue',
        kind: 'page',
        stage: 'json-block',
      },
    )

    expect(merged).toEqual({
      stage: 'json-block',
      file: '/project/src/pages/index/index.vue',
    })
  })

  it('falls back to base when strategy function does not return object', () => {
    const merged = mergeJsonWithStrategy(
      { a: 1 },
      { b: 2 },
      (base) => {
        base.keep = true
      },
      {
        filename: '/project/src/pages/index/index.vue',
        kind: 'page',
        stage: 'macro',
      },
    )

    expect(merged).toEqual({
      a: 1,
      keep: true,
    })
  })

  it('supports replace/assign/deep-merge strategies', () => {
    expect(mergeJsonWithStrategy(
      { a: 1 },
      { b: 2 },
      'replace',
      {
        filename: 'x',
        kind: 'component',
        stage: 'defaults',
      },
    )).toEqual({ b: 2 })

    expect(mergeJsonWithStrategy(
      { a: 1 },
      { a: 2, b: 3 },
      'assign',
      {
        filename: 'x',
        kind: 'component',
        stage: 'defaults',
      },
    )).toEqual({ a: 2, b: 3 })

    expect(mergeJsonWithStrategy(
      { nested: { x: 1 }, arr: [1] as any },
      { nested: { y: 2 }, arr: [2] as any },
      undefined,
      {
        filename: 'x',
        kind: 'component',
        stage: 'defaults',
      },
    )).toEqual({
      nested: { x: 1, y: 2 },
      arr: [2],
    })
  })

  it('normalizes non-record inputs to empty object before merge', () => {
    const merged = mergeJsonWithStrategy(
      null as any,
      1 as any,
      'assign',
      {
        filename: 'x',
        kind: 'component',
        stage: 'macro',
      },
    )
    expect(merged).toEqual({})
  })

  it('creates merger with fixed base context and dynamic stage', () => {
    const merger = createJsonMerger(
      (base, incoming, ctx) => {
        return {
          ...base,
          ...incoming,
          __kind: ctx.kind,
          __stage: ctx.stage,
          __file: ctx.filename,
        }
      },
      {
        filename: '/project/src/app.vue',
        kind: 'app',
      },
    )

    const merged = merger(
      { a: 1 },
      { b: 2 },
      'macro',
    )

    expect(merged).toEqual({
      a: 1,
      b: 2,
      __kind: 'app',
      __stage: 'macro',
      __file: '/project/src/app.vue',
    })
  })
})
