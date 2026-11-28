import type { NativeChunk } from '../../../../../../test/utils/nativeFixture'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildFixture, execute, hasNativeBindingDependency, isNativeBindingChunk } from '../../../../../../test/utils/nativeFixture'
import { WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID } from '../../../../../runtime/config/internal/injectRequestGlobals/nativeInject'

describe('native Web Runtime execution', () => {
  it('applies networkDefaults to a real fetch transport call and preserves per-call overrides', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-network-defaults-'))
    const chunks: NativeChunk[] = []
    const request = vi.fn((options: any) => {
      options.success({
        statusCode: 200,
        header: { 'content-type': 'text/plain' },
        data: new TextEncoder().encode('native fetch ok').buffer,
      })
      return { abort: vi.fn() }
    })
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        networkDefaults: {
          request: {
            timeout: 4321,
            enableHttp2: true,
            enableChunked: true,
          },
        },
        pageSource: `globalThis.__nativeGlobalThisUrl = new globalThis.URL('https://native.example/a/../defaults').pathname
          globalThis.fetch('https://native.example/defaults', { miniProgram: { enableChunked: false } }).then(response => response.text()).then(text => {
            globalThis.__nativeFetchText = text
            Page({ data: { ready: true } })
          })`,
      }))
      const { context, Page, load } = execute(files, [], { wx: { request } })
      expect(context.fetch).toBeUndefined()
      load('pages/index/index.js')
      await vi.waitFor(() => expect(Page).toHaveBeenCalledWith({ data: { ready: true } }))
      expect(context.__nativeFetchText).toBe('native fetch ok')
      expect(context.__nativeGlobalThisUrl).toBe('/defaults')
      expect(request).toHaveBeenCalledOnce()
      expect(request.mock.calls[0]![0]).toMatchObject({
        url: 'https://native.example/defaults',
        method: 'GET',
        timeout: 4321,
        enableHttp2: true,
        enableChunked: false,
        responseType: 'arraybuffer',
      })
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('executes non-Fetch targets without enabling unrelated Fetch bindings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-target-matrix-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        pageSource: `const controller = new AbortController()
          controller.abort('done')
          const encoded = new TextEncoder().encode('native')
          const decoded = new TextDecoder().decode(encoded)
          const custom = new CustomEvent('native', { detail: decoded })
          const readable = new ReadableStream()
          const writable = new WritableStream()
          const transform = new TransformStream()
          const decoderStream = new TextDecoderStream()
          globalThis.__nativeMatrix = {
            aborted: controller.signal.aborted,
            abortReason: controller.signal.reason,
            decoded,
            encodedLength: encoded.byteLength,
            base64: btoa('native'),
            base64Decoded: atob('bmF0aXZl'),
            eventType: custom.type,
            eventDetail: custom.detail,
            eventTarget: custom instanceof CustomEvent,
            readable: readable instanceof ReadableStream,
            writable: writable instanceof WritableStream,
            transform: transform instanceof TransformStream,
            decoderStream: decoderStream instanceof TextDecoderStream,
            performance: performance.now() >= 0,
            random: crypto.getRandomValues(new Uint8Array(4)).length,
            xhr: typeof XMLHttpRequest,
            webSocket: typeof WebSocket,
          }
          queueMicrotask(() => { globalThis.__nativeMicrotask = true })
          Page({ data: { ready: decoded } })`,
        targets: [
          'TextEncoder',
          'TextDecoder',
          'AbortController',
          'AbortSignal',
          'XMLHttpRequest',
          'WebSocket',
          'atob',
          'btoa',
          'queueMicrotask',
          'performance',
          'crypto',
          'Event',
          'CustomEvent',
          'ReadableStream',
          'WritableStream',
          'TransformStream',
          'TextDecoderStream',
        ],
      }))
      const { context, Page } = execute(files)
      await vi.waitFor(() => expect(context.__nativeMicrotask).toBe(true))
      expect(Page).toHaveBeenCalledWith({ data: { ready: 'native' } })
      expect(context.__nativeMatrix).toMatchObject({
        aborted: true,
        abortReason: 'done',
        decoded: 'native',
        encodedLength: 6,
        base64: 'bmF0aXZl',
        base64Decoded: 'native',
        eventType: 'native',
        eventDetail: 'native',
        eventTarget: true,
        readable: true,
        writable: true,
        transform: true,
        decoderStream: true,
        performance: true,
        random: 4,
        xhr: 'function',
        webSocket: 'function',
      })
      expect(context.fetch).toBeUndefined()
      expect(context.EventSource).toBeUndefined()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('runs a lazy custom prelude with precise free and dotted bindings plus declared global bridges', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-prelude-boundary-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        appPreludeMode: 'native',
        appPreludeSource: `const host = globalThis
          const key = 'atob'
          globalThis.__nativePreludeBoundary = {
            fetchType: typeof fetch,
            urlType: typeof URL,
            globalThisFetchType: typeof globalThis.fetch,
            dynamicGlobalType: typeof globalThis[key],
            marker: 'prelude-ran',
          }
          {
            const fetch = () => 'prelude-local'
            globalThis.__nativePreludeLocal = fetch()
          }
          function readVarShadowedFetch() {
            var fetch = () => 'prelude-var'
            return fetch()
          }
          {
            let globalThis = host
            let URL = class PreludeUrl { href = 'prelude-let-url' }
            globalThis.__nativePreludeDeclarations = [readVarShadowedFetch(), new URL().href]
          }`,
        globalTargets: ['atob'],
      }))
      const { context, Page, load } = execute(files, [])
      expect(context.__nativePreludeBoundary).toEqual({
        fetchType: 'function',
        urlType: 'function',
        globalThisFetchType: 'function',
        dynamicGlobalType: 'function',
        marker: 'prelude-ran',
      })
      expect(context.__nativePreludeLocal).toBe('prelude-local')
      expect(context.__nativePreludeDeclarations).toEqual(['prelude-var', 'prelude-let-url'])
      expect(typeof context.atob).toBe('function')
      expect(context.fetch).toBeUndefined()
      expect(context.URL).toBeUndefined()
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(true)
      const preludeChunk = chunks.find(chunk => chunk.moduleIds.includes(WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID))
      expect(preludeChunk).toBeDefined()
      expect(isNativeBindingChunk(preludeChunk!)).toBe(true)
      expect(Page).not.toHaveBeenCalled()
      load('pages/index/index.js')
      expect(typeof context.atob).toBe('function')
      expect(context.fetch).toBeUndefined()
      expect(context.URL).toBeUndefined()
      expect(context.__nativePreludeBoundary.marker).toBe('prelude-ran')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('cold-starts an independent subpackage without loading the main package binding chunk', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-independent-lazy-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        independent: true,
      }))
      const { context, Page, loaded } = execute(files, ['pkg/pages/index/index.js'])
      expect(hasNativeBindingDependency(chunks, 'app.js')).toBe(false)
      expect(hasNativeBindingDependency(chunks, 'pkg/pages/index/index.js')).toBe(true)
      expect(loaded.has('pages/index/index.js')).toBe(false)
      expect(Page).toHaveBeenCalledWith({ data: { ready: true } })
      expect(typeof context.autoStreamProbe.readable.getReader).toBe('function')
      expect(typeof context.autoStreamProbe.writable.getWriter).toBe('function')
      const loadedBindingChunks = chunks.filter(chunk => loaded.has(chunk.fileName) && isNativeBindingChunk(chunk))
      expect(loadedBindingChunks.length).toBeGreaterThan(0)
      expect(loadedBindingChunks.every(chunk => chunk.fileName.startsWith('pkg/'))).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('injects Vue SFC free identifiers while preserving lexical shadowing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-vue-'))
    const chunks: NativeChunk[] = []
    try {
      const files = new Map(await buildFixture(root, false, chunks, {
        pageSource: `<template><view>{{ ready }}</view></template>
          <script setup lang="ts">
          const fetch = () => 'lexical fetch'
          const ready = atob('dnVl')
          globalThis.__nativeVue = {
            fetchType: typeof fetch,
            shadowed: fetch(),
            url: new URL('https://vue.example/a/../b').pathname,
          }
          </script>`,
        vue: true,
      }))
      const { context, Component, load } = execute(files)
      const definition = load('pages/index/index.js') as {
        setup: (props: object, context: { expose: () => void }) => { ready: string }
      }
      expect(definition.setup({}, { expose: vi.fn() })).toEqual(expect.objectContaining({ ready: 'vue' }))
      expect(Component).toHaveBeenCalledOnce()
      expect(context.__nativeVue).toEqual({
        fetchType: 'function',
        shadowed: 'lexical fetch',
        url: '/b',
      })
      expect(hasNativeBindingDependency(chunks, 'pages/index/index.js')).toBe(true)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
