import { describe, expect, it, vi } from 'vitest'
import { prepareWorker } from './worker'

describe('vite-native-ts worker helper', () => {
  it('preloads worker subpackage before creating worker', async () => {
    const calls: string[] = []
    const worker = {
      onMessage: vi.fn(),
      onProcessKilled: vi.fn(),
      onError: vi.fn(),
    }
    const wxApi = {
      preDownloadSubpackage: vi.fn(({ success }: { success?: () => void }) => {
        calls.push('preDownloadSubpackage')
        success?.()
      }),
      createWorker: vi.fn(() => {
        calls.push('createWorker')
        return worker
      }),
    }

    const result = await prepareWorker(wxApi, {
      workerPath: 'workers/index.js',
      workerSubpackage: true,
    })

    expect(result).toEqual({
      status: 'ready',
      detail: 'worker 已创建',
      worker,
    })
    expect(calls).toEqual(['preDownloadSubpackage', 'createWorker'])
  })

  it('returns preload failure when worker subpackage cannot be downloaded', async () => {
    const wxApi = {
      preDownloadSubpackage: vi.fn(({ fail }: { fail?: (error: unknown) => void }) => {
        fail?.(new Error('download failed'))
      }),
      createWorker: vi.fn(),
    }

    const result = await prepareWorker(wxApi, {
      workerPath: 'workers/index.js',
      workerSubpackage: true,
    })

    expect(result.status).toBe('error')
    expect(result.detail).toContain('worker 分包预下载失败')
    expect(wxApi.createWorker).not.toHaveBeenCalled()
  })

  it('returns unsupported when createWorker does not return a usable worker instance', async () => {
    const wxApi = {
      createWorker: vi.fn(() => undefined),
    }

    const result = await prepareWorker(wxApi, {
      workerPath: 'workers/index.js',
      workerSubpackage: false,
    })

    expect(result).toEqual({
      status: 'unsupported',
      detail: '当前环境暂不支持完整 worker 能力',
    })
  })
})
