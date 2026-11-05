import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileMeasurement } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHROMIUM_ARGUMENTS } from '../../benchmarkWxmlParser/runtime'
import { profileChromium } from './browser'

const launch = vi.hoisted(() => vi.fn())
vi.mock('playwright', () => ({ chromium: { launch } }))
vi.mock('../../benchmarkWxmlParser/browserDocument', () => ({ installBenchmarkDocument: async () => {}, loadBenchmarkDocument: async () => ({ crossOriginIsolated: true }) }))

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'TemplateCorpusProfile')
  Reflect.deleteProperty(globalThis, '__templateCorpusCheckpoint')
  vi.clearAllMocks()
})

function transport() {
  const page = {
    exposeBinding: vi.fn(async (name: string, binding: (_source: unknown, record: ProfileCheckpoint) => Promise<void>) => {
      Reflect.set(globalThis, name, (record: ProfileCheckpoint) => binding({}, record))
    }),
    on: vi.fn(),
    addScriptTag: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    evaluate: vi.fn(async (evaluate: (input: unknown) => unknown, input: unknown) => evaluate(input)),
  }
  const context = { newPage: async () => page, close: vi.fn(async () => {}) }
  const browser = { newBrowserCDPSession: async () => ({ send: async () => ({ arguments: [...CHROMIUM_ARGUMENTS, '--headless'] }), detach: async () => {} }), newContext: async () => context, close: vi.fn(async () => {}), version: () => 'controlled-browser-transport' }
  launch.mockResolvedValue(browser)
  return { page, context, browser }
}

describe('Chromium checkpoint transport without launching a browser', () => {
  it('awaits the durable Node acknowledgement before completing browser evaluation', async () => {
    const resources = transport()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const record = { kind: 'complete', cells: 0, samples: 0, warmupSamples: 0, parity: 0, errors: 0 } as const
    const result = { marker: 'complete-raw-result' } as unknown as ProfileMeasurement
    const checkpoint = vi.fn(async () => blocked)
    const runWithCheckpoint = vi.fn(async (_fixtures: ProfileFixture[], _groups: ProfileGroup[], _options: unknown, write: (record: ProfileCheckpoint) => Promise<void>) => {
      await write(record)
      return result
    })
    Reflect.set(globalThis, 'TemplateCorpusProfile', { runWithCheckpoint })
    const work = profileChromium('controlled transport', [], [], { rounds: 1, warmup: 0 }, checkpoint)
    await vi.waitFor(() => expect(checkpoint).toHaveBeenCalledExactlyOnceWith(record))
    expect(resources.page.close).not.toHaveBeenCalled()
    release()
    expect((await work).result).toBe(result)
    expect(resources.context.close).toHaveBeenCalledOnce()
    expect(resources.browser.close).toHaveBeenCalledOnce()
  })

  it('propagates a persistence failure and releases its browser resources', async () => {
    const resources = transport()
    Reflect.set(globalThis, 'TemplateCorpusProfile', { runWithCheckpoint: async (_fixtures: unknown, _groups: unknown, _options: unknown, write: (record: ProfileCheckpoint) => Promise<void>) => write({ kind: 'complete', cells: 0, samples: 0, warmupSamples: 0, parity: 0, errors: 0 }) })
    await expect(profileChromium('controlled transport', [], [], { rounds: 1, warmup: 0 }, async () => {
      throw new Error('durable write failed')
    })).rejects.toThrow('durable write failed')
    expect(resources.context.close).toHaveBeenCalledOnce()
    expect(resources.browser.close).toHaveBeenCalledOnce()
  })
})
