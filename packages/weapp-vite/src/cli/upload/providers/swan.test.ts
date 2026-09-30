import type * as UploadTools from '../tools'
import type { UploadContext } from '../types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runUploadCli } from '../tools'
import { prepareSwanUpload } from './swan'

vi.mock('../tools', async (importOriginal) => {
  const tools = await importOriginal<typeof UploadTools>()
  return { ...tools, runUploadCli: vi.fn() }
})

describe('Swan result boundary', () => {
  let context: UploadContext

  beforeEach(async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-swan-preview-'))
    context = {
      cwd,
      projectPath: cwd,
      appid: 'swan-test-app',
      version: '',
      desc: '',
      env: { SWAN_UPLOAD_TOKEN: 'test-token', SWAN_MIN_VERSION: '3.100.0' },
    }
    await writeFile(path.join(cwd, 'project.swan.json'), JSON.stringify({ appid: context.appid }))
  })

  afterEach(async () => {
    vi.mocked(runUploadCli).mockReset()
    await rm(context.cwd, { recursive: true, force: true })
  })

  it('selects the official default-version link after compiler logs and a low-version entry', async () => {
    vi.mocked(runUploadCli).mockResolvedValue(`compiler log\r\nNODE_JS_ENV_RESULT:${JSON.stringify({
      list: [
        { title: '低版本', url: 'baiduboxapp://swan/low' },
        { title: '默认版本', url: 'baiduboxapp://swan/default', bundle_id: 'internal-only' },
      ],
    }, null, 2)}\r\n`)

    const prepared = await prepareSwanUpload(context, 'preview')
    expect(await prepared.run()).toEqual({ previewUrl: 'baiduboxapp://swan/default' })
  })

  it.each([
    '{"list":[{"url":"baiduboxapp://swan/unframed"}]}',
    'NODE_JS_ENV_RESULT:{broken',
    'NODE_JS_ENV_RESULT:{"list":[]}',
    'NODE_JS_ENV_RESULT:{"list":[{"url":" "}]}',
  ])('rejects absent, malformed or unusable official results: %s', async (output) => {
    vi.mocked(runUploadCli).mockResolvedValue(output)
    const prepared = await prepareSwanUpload(context, 'preview')
    await expect(prepared.run()).rejects.toThrow()
  })

  it('still requires the official minimum Swan version for preview', async () => {
    delete context.env.SWAN_MIN_VERSION
    await expect(prepareSwanUpload(context, 'preview')).rejects.toThrow('SWAN_MIN_VERSION')
  })

  it('does not relax the upload version contract when preview skips release metadata', async () => {
    await expect(prepareSwanUpload(context, 'upload')).rejects.toThrow('版本号')
  })

  it('captures framed upload JSON after compiler logs without confusing it with preview metadata', async () => {
    context.version = '1.2.3'
    const result = { schemeUrl: 'baiduboxapp://swan/upload', fileSize: 1024, warningList: ['app.js:1:1 scan warning'] }
    vi.mocked(runUploadCli).mockImplementation(async (cliContext, _packageName, _binName, _args, _secrets, captureOutput) => {
      if (cliContext.env.IS_NODE_JS !== 'true' || !captureOutput) {
        throw new Error('Official result framing and capture must be enabled.')
      }
      return `compiler log\r\nNODE_JS_ENV_RESULT:${JSON.stringify(result, null, 2)}\r\n`
    })
    const prepared = await prepareSwanUpload(context)
    expect(await prepared.run()).toEqual(result)
  })

  it.each([
    '{"schemeUrl":"baiduboxapp://swan/unframed"}',
    'NODE_JS_ENV_RESULT:{broken',
  ])('rejects missing or malformed framed upload JSON: %s', async (output) => {
    context.version = '1.2.3'
    vi.mocked(runUploadCli).mockResolvedValue(output)
    const prepared = await prepareSwanUpload(context)
    await expect(prepared.run()).rejects.toThrow('百度上传未返回有效的 JSON 结果。')
  })
})
