import { describe, expect, it } from 'vitest'
import { resolveWebRuntimeGlobalTargetDependencies, WEB_RUNTIME_GLOBAL_TARGETS } from '../src/webRuntimeGlobals'

describe('shared Web Runtime target dependencies', () => {
  it('gives EventSource the same request and stream prerequisites in every consumer', () => {
    const targets = resolveWebRuntimeGlobalTargetDependencies(['EventSource'])
    expect(targets).toEqual(expect.arrayContaining([
      'EventSource',
      'fetch',
      'Headers',
      'Request',
      'Response',
      'AbortController',
      'AbortSignal',
      'TextEncoder',
      'TextDecoder',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'Event',
    ]))
    expect(targets).not.toContain('XMLHttpRequest')
    expect(targets.every(target => WEB_RUNTIME_GLOBAL_TARGETS.includes(target))).toBe(true)
  })

  it('keeps a coherent stream family for a text decoder pipeline', () => {
    expect(resolveWebRuntimeGlobalTargetDependencies(['TextDecoderStream'])).toEqual([
      'TextDecoderStream',
      'TextDecoder',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
    ])
  })

  it('keeps repeated expansion stable and leaves abort-only installations small', () => {
    const targets = resolveWebRuntimeGlobalTargetDependencies(['EventSource', 'fetch'])
    expect(resolveWebRuntimeGlobalTargetDependencies(targets)).toEqual(targets)
    expect(resolveWebRuntimeGlobalTargetDependencies(['AbortSignal'])).toEqual(['AbortSignal'])
  })
})
