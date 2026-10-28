import { REQUEST_GLOBAL_INSTALLER_HOST_REF } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import {
  createInjectRequestGlobalsCode,
  FULL_REQUEST_GLOBAL_TARGETS,
  resolveAutoRequestGlobalsTargets,
  resolveInjectRequestGlobalsOptions,
  resolveRequestGlobalsBindingTargets,
} from '../injectRequestGlobals'

describe('streaming Web Runtime injection', () => {
  it('activates dependency-driven analysis for eventsource-parser projects', () => {
    expect(resolveInjectRequestGlobalsOptions(undefined, {
      dependencies: { 'eventsource-parser': '^3.1.1' },
    })).toMatchObject({ mode: 'auto', prelude: true, targets: FULL_REQUEST_GLOBAL_TARGETS })
  })

  it('installs TransformStream before a parser module evaluates its superclass', () => {
    expect(resolveAutoRequestGlobalsTargets([
      'import { EventSourceParserStream } from "eventsource-parser/stream"',
      'export const parser = new EventSourceParserStream()',
    ].join('\n'), FULL_REQUEST_GLOBAL_TARGETS)).toEqual([
      'ReadableStream',
      'WritableStream',
      'TransformStream',
    ])
  })

  it('expands decoder and EventSource references without enabling XMLHttpRequest', () => {
    const targets = resolveAutoRequestGlobalsTargets([
      'export const decoder = new TextDecoderStream()',
      'export const source = new EventSource("https://sse.invalid/events")',
    ].join('\n'), FULL_REQUEST_GLOBAL_TARGETS)
    expect(targets).toEqual(expect.arrayContaining([
      'EventSource',
      'fetch',
      'Headers',
      'Request',
      'Response',
      'Event',
      'AbortController',
      'AbortSignal',
      'TextDecoder',
      'TextDecoderStream',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
    ]))
    expect(targets).not.toContain('XMLHttpRequest')
  })

  it('does not inject streams for locally supplied constructors', () => {
    expect(resolveAutoRequestGlobalsTargets([
      'import { TransformStream, EventSource } from "./own-runtime"',
      'export const decoder = new TransformStream()',
      'export const source = new EventSource("https://sse.invalid/events")',
    ].join('\n'), FULL_REQUEST_GLOBAL_TARGETS)).toEqual([])
  })

  it('retains all EventSource dependencies in isolated chunk scopes', () => {
    const targets = resolveRequestGlobalsBindingTargets(['EventSource'])
    expect(targets).toEqual(expect.arrayContaining([
      'EventSource',
      'fetch',
      'Response',
      'AbortController',
      'TextDecoder',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'URL',
    ]))
    const code = createInjectRequestGlobalsCode(['EventSource'], { localBindings: true })
    for (const target of targets) {
      expect(code).toContain(`var ${target} = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.${target}`)
    }
  })

  it('keeps streaming opt-in in installer options alongside all stream constructors', () => {
    const code = createInjectRequestGlobalsCode(['fetch', 'TextDecoderStream'], {
      localBindings: true,
      networkDefaults: { request: { enableChunked: true } },
    })
    expect(code).toContain('"enableChunked":true')
    expect(code).toContain(`var TransformStream = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.TransformStream`)
    expect(code).toContain(`var TextDecoder = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.TextDecoder`)
  })
})
