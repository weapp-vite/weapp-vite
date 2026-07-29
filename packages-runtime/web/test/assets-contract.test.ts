import type { IncomingMessage, ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebAssetMiddleware,
  emitWebAssets,
  resolveWebAssetRequest,
} from '../src/plugin/assets'

const streamRuntime = vi.hoisted(() => ({
  createReadStream: vi.fn(),
}))

vi.mock('node:fs', () => ({
  createReadStream: streamRuntime.createReadStream,
}))

class FakeReadStream extends EventEmitter {
  pipe = vi.fn()
}

async function createAssetRoot() {
  const root = await mkdtemp(join(tmpdir(), 'weapp-web-assets-'))
  await mkdir(join(root, 'nested'), { recursive: true })
  await mkdir(join(root, 'directory.png'))
  await writeFile(join(root, 'logo.PNG'), new Uint8Array([1, 2, 3]))
  await writeFile(join(root, 'nested/data.br'), new Uint8Array([4, 5]))
  await writeFile(join(root, 'nested/readme.txt'), 'ignored')
  return root
}

describe('web asset contract', () => {
  beforeEach(() => {
    streamRuntime.createReadStream.mockReset()
  })

  it('resolves valid asset URLs and rejects invalid or escaping requests', async () => {
    const root = await createAssetRoot()
    expect(resolveWebAssetRequest(root)).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/logo.PNG?version=1#image')).toBe(join(root, 'logo.PNG'))
    expect(resolveWebAssetRequest(root, '/nested%2Fdata.br')).toBe(join(root, 'nested/data.br'))
    expect(resolveWebAssetRequest(root, '/')).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/readme.txt')).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/../outside.png')).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/%2e%2e/outside.png')).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/%5c..%5coutside.png')).toBeUndefined()
    expect(resolveWebAssetRequest(root, '/%252e%252e/outside.png')).toBe(join(root, '%2e%2e/outside.png'))
    expect(resolveWebAssetRequest(root, '/%E0%A4%A')).toBeUndefined()
  })

  it('recursively emits assets with optional watch registration', async () => {
    const root = await createAssetRoot()
    await expect(emitWebAssets({}, root)).resolves.toBeUndefined()

    const emitFile = vi.fn()
    await emitWebAssets({ emitFile }, root)
    expect(emitFile).toHaveBeenCalledTimes(2)
    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'logo.PNG',
      source: expect.any(Uint8Array),
      type: 'asset',
    }))

    const addWatchFile = vi.fn()
    emitFile.mockClear()
    await emitWebAssets({ addWatchFile, emitFile }, root)
    expect(addWatchFile).toHaveBeenCalledTimes(2)
    expect(emitFile).toHaveBeenCalledTimes(2)
  })

  it('serves files, falls through invalid requests and forwards stream errors', async () => {
    const root = await createAssetRoot()
    const stream = new FakeReadStream()
    streamRuntime.createReadStream.mockReturnValue(stream)
    const middleware = createWebAssetMiddleware(root)
    const next = vi.fn()
    const headers = new Map<string, string>()
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value)
      },
      statusCode: 0,
    } as unknown as ServerResponse

    middleware({ url: undefined } as IncomingMessage, response, next)
    middleware({ url: '/missing.png' } as IncomingMessage, response, next)
    middleware({ url: '/directory.png' } as IncomingMessage, response, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(3))

    middleware({ url: '/logo.PNG' } as IncomingMessage, response, next)
    await vi.waitFor(() => expect(streamRuntime.createReadStream).toHaveBeenCalledWith(join(root, 'logo.PNG')))
    expect(response.statusCode).toBe(200)
    expect(headers.get('Content-Length')).toBe('3')
    expect(headers.get('Content-Type')).toBe('image/png')
    expect(stream.pipe).toHaveBeenCalledWith(response)

    middleware({ url: '/nested/data.br' } as IncomingMessage, response, next)
    await vi.waitFor(() => expect(streamRuntime.createReadStream).toHaveBeenCalledTimes(2))
    expect(headers.get('Content-Type')).toBe('application/octet-stream')

    const error = new Error('stream failed')
    stream.emit('error', error)
    expect(next).toHaveBeenCalledWith(error)
  })
})
