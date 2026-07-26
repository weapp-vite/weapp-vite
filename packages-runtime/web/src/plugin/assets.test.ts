import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { createWebAssetMiddleware, emitWebAssets, resolveWebAssetRequest } from './assets'

describe('Web 小程序静态资源', () => {
  it('只解析 srcRoot 内允许的资源路径', () => {
    expect(resolveWebAssetRequest('/project/src', '/assets/sample.png'))
      .toBe('/project/src/assets/sample.png')
    expect(resolveWebAssetRequest('/project/src', '/pages/index/index.vue')).toBeUndefined()
    expect(resolveWebAssetRequest('/project/src', '/%2e%2e/secret.png')).toBeUndefined()
  })

  it('在开发服务器返回源码目录中的二进制资源', async () => {
    const srcRoot = await mkdtemp(join(tmpdir(), 'weapp-web-assets-'))
    const assetDir = join(srcRoot, 'assets')
    const source = Buffer.from([137, 80, 78, 71])
    await mkdir(assetDir, { recursive: true })
    await writeFile(join(assetDir, 'sample.png'), source)

    const middleware = createWebAssetMiddleware(srcRoot)
    const response = new PassThrough() as PassThrough & ServerResponse
    const headers = new Map<string, string>()
    response.setHeader = ((name: string, value: string | number | readonly string[]) => {
      headers.set(name.toLowerCase(), String(value))
      return response
    }) as typeof response.setHeader
    const chunks: Buffer[] = []
    response.on('data', chunk => chunks.push(Buffer.from(chunk)))
    const completed = new Promise<void>((resolve) => {
      response.on('finish', resolve)
    })
    const next = vi.fn()
    middleware({ url: '/assets/sample.png' } as IncomingMessage, response, next)
    await completed

    expect(next).not.toHaveBeenCalled()
    expect(headers.get('content-type')).toBe('image/png')
    expect(Buffer.concat(chunks)).toEqual(source)
  })

  it('通过 bundler emitFile 发射构建资源', async () => {
    const srcRoot = await mkdtemp(join(tmpdir(), 'weapp-web-assets-'))
    const assetDir = join(srcRoot, 'assets')
    await mkdir(assetDir, { recursive: true })
    await writeFile(join(assetDir, 'sample.png'), Buffer.from('png'))
    await writeFile(join(assetDir, 'ignored.txt'), 'ignored')
    const emitFile = vi.fn()
    const addWatchFile = vi.fn()

    await emitWebAssets({ emitFile, addWatchFile }, srcRoot)

    expect(emitFile).toHaveBeenCalledTimes(1)
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'assets/sample.png',
      source: Buffer.from('png'),
    })
    expect(addWatchFile).toHaveBeenCalledWith(join(assetDir, 'sample.png'))
  })
})
