import type { AxiosAdapter } from 'axios'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspect } from 'node:util'
import axios, { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateAutoImportComponents } from './index'

const createClient = axios.create.bind(axios)
const request = vi.fn<AxiosAdapter>()
const log = vi.fn()
let outputDir: string

function generate() {
  return updateAutoImportComponents({ outputDir, log })
}

beforeEach(async () => {
  outputDir = await mkdtemp(path.join(tmpdir(), 'component-update-'))
  vi.stubEnv('GITHUB_TOKEN', '')
  vi.stubEnv('GH_TOKEN', '')
  vi.stubEnv('GITHUB_ACTIONS', '')
  request.mockReset().mockImplementation(async config => ({
    data: [{ name: 'button', type: 'dir' }],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  log.mockReset()
  vi.spyOn(axios, 'create').mockImplementation(config => createClient({ ...config, adapter: request }))
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(outputDir, { recursive: true, force: true })
})

describe('component updater GitHub authentication', () => {
  it.each([
    { github: ' workflow-token ', gh: 'cli-token', expected: 'Bearer workflow-token' },
    { github: '', gh: ' cli-token ', expected: 'Bearer cli-token' },
    { github: '  ', gh: 'cli-token', expected: 'Bearer cli-token' },
    { github: '', gh: '', expected: undefined },
  ])('uses the configured credential ($expected)', async ({ github, gh, expected }) => {
    vi.stubEnv('GITHUB_TOKEN', github)
    vi.stubEnv('GH_TOKEN', gh)
    await generate()
    expect(request).toHaveBeenCalledTimes(3)
    for (const [config] of request.mock.calls) {
      expect(new URL(config.url!).origin).toBe('https://api.github.com')
      expect(config.headers.Authorization).toBe(expected)
      expect(config.headers.Accept).toBe('application/vnd.github+json')
      expect(config.timeout).toBe(30_000)
    }
  })

  it('fails before any request or write when Actions has no token', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    await expect(generate()).rejects.toThrow('GITHUB_TOKEN or GH_TOKEN is required')
    expect(request).not.toHaveBeenCalled()
    expect(await readdir(outputDir)).toEqual([])
  })

  it('supports the authenticated Actions path', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_TOKEN', 'workflow-token')
    await generate()
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[0]![0].headers.Authorization).toBe('Bearer workflow-token')
  })
})

describe('component updater output contract', () => {
  it('reads the three upstream paths directly and preserves normalized sorted JSON', async () => {
    request.mockImplementation(async (config) => {
      const names = [
        ' Zebra ',
        'button',
        'button',
        'bad_name',
        '1invalid',
        'common',
        'layout',
        'locale',
        'mixins',
        'wxs',
        'static',
        'utils',
      ]
      return {
        data: [
          ...names.map(name => ({ name, type: 'dir' })),
          { name: 'readme', type: 'file' },
          { name: 'linked', type: 'symlink' },
          { name: 'submodule', type: 'submodule' },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    })
    await generate()
    expect(request.mock.calls.map(([config]) => new URL(config.url!).pathname + new URL(config.url!).search)).toEqual([
      '/repos/Tencent/tdesign-miniprogram/contents/packages/components?ref=develop',
      '/repos/youzan/vant-weapp/contents/packages?ref=dev',
      '/repos/wechat-miniprogram/weui-miniprogram/contents/src/components?ref=master',
    ])
    expect(await readdir(outputDir)).toEqual(['tdesign.json', 'vant.json', 'weui.json'])
    const expected: Record<string, string[]> = {
      tdesign: ['button', 'static', 'utils', 'wxs', 'zebra'],
      vant: ['button', 'layout', 'locale', 'static', 'utils', 'zebra'],
      weui: ['button', 'common', 'layout', 'locale', 'mixins', 'wxs', 'zebra'],
    }
    for (const [name, names] of Object.entries(expected)) {
      expect(await readFile(path.join(outputDir, `${name}.json`), 'utf8')).toBe(JSON.stringify(names, null, 2))
    }
  })

  it.each([
    { data: { message: 'API error' }, message: 'Unexpected GitHub response' },
    { data: [null], message: 'Unexpected GitHub directory entry' },
    { data: [], message: 'No directories extracted' },
    { data: [{ name: 'common', type: 'dir' }], message: 'No directories extracted' },
  ])('rejects invalid or empty responses without replacing existing output ($message)', async ({ data, message }) => {
    await writeFile(path.join(outputDir, 'tdesign.json'), '["existing"]')
    request.mockImplementationOnce(async config => ({ data, status: 200, statusText: 'OK', headers: {}, config }))
    await expect(generate()).rejects.toThrow(message)
    expect(await readFile(path.join(outputDir, 'tdesign.json'), 'utf8')).toBe('["existing"]')
    expect(await readdir(outputDir)).toEqual(['tdesign.json'])
  })

  it('preserves every existing file if a later source fails', async () => {
    for (const name of ['tdesign', 'vant', 'weui']) {
      await writeFile(path.join(outputDir, `${name}.json`), '["existing"]')
    }
    request.mockImplementationOnce(async config => ({
      data: [{ name: 'new-component', type: 'dir' }],
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })).mockRejectedValueOnce(new AxiosError('upstream unavailable'))
    await expect(generate()).rejects.toThrow('GitHub API request failed')
    for (const name of ['tdesign', 'vant', 'weui']) {
      expect(await readFile(path.join(outputDir, `${name}.json`), 'utf8')).toBe('["existing"]')
    }
  })
})

describe('component updater failure diagnostics', () => {
  it.each([
    { status: 403, remaining: '0', rateLimited: true },
    { status: 429, remaining: undefined, rateLimited: true },
    { status: 401, remaining: undefined, rateLimited: false },
    { status: 403, remaining: '42', rateLimited: false },
    { status: undefined, remaining: undefined, rateLimited: false },
  ])('reports HTTP $status without logging credentials or the Axios request', async ({ status, remaining, rateLimited }) => {
    const secret = 'test-only-sensitive-credential'
    vi.stubEnv('GITHUB_TOKEN', secret)
    request.mockImplementationOnce(async (config) => {
      throw new AxiosError(secret, 'ERR_BAD_REQUEST', config, { secret }, {
        data: { message: secret },
        status: status!,
        statusText: 'failed',
        headers: { 'x-ratelimit-remaining': remaining },
        config,
      })
    })
    const error: unknown = await generate().catch(error => error)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(`(${status ?? 'network error'})`)
    expect((error as Error).message.includes('Rate limit exceeded')).toBe(rateLimited)
    expect(inspect(error, { showHidden: true })).not.toContain(secret)
    expect(inspect(log.mock.calls)).not.toContain(secret)
    expect(await readdir(outputDir)).toEqual([])
  })
})
