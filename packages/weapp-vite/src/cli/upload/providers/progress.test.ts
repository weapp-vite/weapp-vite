import type * as UploadTools from '../tools'
import type { UploadContext, UploadProgress } from '../types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUploadPackage } from '../tools'
import { prepareAlipayUpload } from './alipay'
import { prepareWechatUpload } from './wechat'
import { prepareXhsUpload } from './xhs'

vi.mock('../tools', async (importOriginal) => {
  const tools = await importOriginal<typeof UploadTools>()
  return { ...tools, loadUploadPackage: vi.fn() }
})

describe('official upload progress boundaries', () => {
  let context: UploadContext

  beforeEach(async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-progress-'))
    context = { cwd, projectPath: cwd, appid: 'test-app', version: '1.2.3', desc: 'test upload', env: {} }
  })

  afterEach(async () => {
    vi.mocked(loadUploadPackage).mockReset()
    await rm(context.cwd, { recursive: true, force: true })
  })

  it('reports WeChat task states without fake percentages or raw task credentials', async () => {
    context.env.WEAPP_CI_PRIVATE_KEY_PATH = 'key.pem'
    await writeFile(path.join(context.cwd, 'key.pem'), 'test-private-key')
    vi.mocked(loadUploadPackage).mockResolvedValue({
      Project: class {},
      async upload(options: { onProgressUpdate: (task: unknown) => void }) {
        options.onProgressUpdate({ id: 'internal-task', status: 'doing', message: 'compiling test-private-key', credentials: 'do-not-copy' })
        options.onProgressUpdate('uploaded test-private-key')
      },
    })
    const prepared = await prepareWechatUpload(context)
    const progress: UploadProgress[] = []
    await prepared.run(event => progress.push(event))
    expect(progress).toEqual([
      { type: 'progress', message: 'doing: compiling [REDACTED]' },
      { type: 'progress', message: 'uploaded [REDACTED]' },
    ])
  })

  it('preserves real XHS percentages and treats -1 as a failure log rather than progress', async () => {
    context.env.XHS_UPLOAD_TOKEN = 'test-token'
    await writeFile(path.join(context.cwd, 'project.config.json'), JSON.stringify({ appid: context.appid }))
    vi.mocked(loadUploadPackage).mockResolvedValue({
      CI: class {
        core = { login: async () => {} }
        setAppConfig() {}
        async upload(options: { progressCallback: (progress: number) => void }) {
          for (const progress of [0, 5, 52.5, -1, -2, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
            options.progressCallback(progress)
          }
          throw new Error('official upload rejection')
        }
      },
    })
    const prepared = await prepareXhsUpload(context)
    const progress: UploadProgress[] = []
    await expect(prepared.run(event => progress.push(event))).rejects.toThrow('official upload rejection')
    expect(progress).toEqual([
      { type: 'progress', percent: 0 },
      { type: 'progress', percent: 5 },
      { type: 'progress', percent: 52.5 },
      { type: 'log', message: '小红书 SDK 报告上传失败。' },
    ])
  })

  it('keeps Alipay log, task and version events distinct and redacts identity values', async () => {
    context.env.ALIPAY_IDENTITY_KEY_PATH = 'identity.json'
    await writeFile(path.join(context.cwd, 'identity.json'), JSON.stringify({ alipay: { authentication: 'test-auth-secret' } }))
    vi.mocked(loadUploadPackage).mockResolvedValue({
      minidev: {
        async upload(_options: unknown, hooks: { onLog: (message: string) => void, onTaskCreated: (taskId: string) => void, onVersionCreated: (version: string) => void }) {
          hooks.onLog('building test-auth-secret')
          hooks.onTaskCreated('task-test-auth-secret')
          hooks.onVersionCreated('1.2.3-test-auth-secret')
          return { version: '1.2.3' }
        },
      },
    })
    const prepared = await prepareAlipayUpload(context)
    const progress: UploadProgress[] = []
    await prepared.run(event => progress.push(event))
    expect(progress).toEqual([
      { type: 'log', message: 'building [REDACTED]' },
      { type: 'task-created', message: 'task-[REDACTED]' },
      { type: 'version-created', message: '1.2.3-[REDACTED]' },
    ])
  })
})
