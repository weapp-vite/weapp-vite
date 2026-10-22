import type { captureNativePublication } from '.'
import type { startDevProcess } from '../dev-process'
import { afterEach, expect, it, vi } from 'vitest'
import { captureNativeConfigReload } from './configReload'
import { nativePublicationGeneration, nativePublicationHash } from './files'

type NativeObservation = Awaited<ReturnType<ReturnType<typeof captureNativePublication>['wait']>>

const capture = vi.hoisted(() => ({ native: vi.fn<typeof captureNativePublication>() }))
vi.mock('../nativePublication', () => ({ captureNativePublication: capture.native }))

const hostReady = {
  'wv': 'Vite 配置已重新加载，小程序开发构建已重启。\n',
  'vite': '[weapp-vite] 小程序开发产物已就绪 (classic)\n',
  'vite-plus': '[weapp-vite] 小程序开发产物已就绪 (classic)\n',
}

afterEach(() => vi.resetAllMocks())

function fixture(host: keyof typeof hostReady, initialOutput = '') {
  let output = initialOutput
  const native = Promise.withResolvers<NativeObservation>()
  capture.native.mockReturnValue({ wait: vi.fn(() => native.promise) })
  const dev = {
    getOutput: () => output,
    waitFor: async <T>(pending: Promise<T>) => await pending,
  } as ReturnType<typeof startDevProcess>
  const publication = captureNativeConfigReload(dev, 'fixture-project', host)
  return {
    native,
    publication,
    append: (text: string) => { output += text },
    receipt(): NativeObservation {
      const files = { 'app.js': nativePublicationHash('App({})') }
      return {
        boundary: 'native-byte-write',
        generation: nativePublicationGeneration(files),
        inputs: { 'src/app.js': files['app.js'] },
        outputs: files,
        outputOffset: output.length,
      }
    },
  }
}

it.each(['wv', 'vite', 'vite-plus'] as const)('requires %s formal config completion after the final native receipt', async (host) => {
  const run = fixture(host, hostReady[host])
  let finished = false
  const pending = run.publication.wait().then(() => {
    finished = true
  })
  run.append('final native receipt\n')
  run.native.resolve(run.receipt())
  expect(finished).toBe(false)
  run.append(hostReady[host])
  await expect(pending).resolves.toBeUndefined()
  expect(finished).toBe(true)
})

it.each(['wv', 'vite'] as const)('does not reuse an old %s startup completion', async (host) => {
  const run = fixture(host, hostReady[host])
  run.append('final native receipt\n')
  run.native.resolve(run.receipt())
  await expect(run.publication.wait(100)).rejects.toThrow('current classic configuration restart completion')
})

it.each(['wv', 'vite'] as const)('rejects %s readiness that precedes the final native write', async (host) => {
  const run = fixture(host)
  run.append(hostReady[host])
  run.append('later final native receipt\n')
  run.native.resolve(run.receipt())
  await expect(run.publication.wait()).rejects.toThrow('completed before the final native write')
})

it('preserves the original native failure instead of accepting config readiness', async () => {
  const run = fixture('wv')
  run.append(hostReady.wv)
  const error = new Error('original native write failed')
  const rejected = expect(run.publication.wait()).rejects.toBe(error)
  run.native.reject(error)
  await rejected
})

it('rejects a post-write failure even when a later formal completion is logged', async () => {
  const run = fixture('vite')
  run.append('final native receipt\n')
  run.native.resolve(run.receipt())
  run.append(`Build failed with 1 error: original post-write failure\n${hostReady.vite}`)
  await expect(run.publication.wait()).rejects.toThrow('preserve the original dev build error')
})
