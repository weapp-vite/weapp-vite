import type { WeappUploadConfig } from '../../types'
import type * as UploadModule from '../upload'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPreviewCommand, registerUploadCommand, runUploadCommand } from './upload'

const state = vi.hoisted(() => ({
  createContext: vi.fn(),
  prepare: vi.fn(),
  execute: vi.fn(),
}))
vi.mock('../../createContext', () => ({ createCompilerContext: state.createContext }))
vi.mock('../upload', async importOriginal => ({
  ...await importOriginal<typeof UploadModule>(),
  prepareUpload: state.prepare,
}))
vi.mock('../upload/process', () => ({ executeUpload: state.execute }))
vi.mock('../../logger', () => ({ default: { info: vi.fn(), success: vi.fn() } }))
vi.mock('./build', () => ({ scheduleCompletedProductionBuildExit: vi.fn() }))

let root: string
let events: string[]
let failBuild: boolean
let uploadConfig: WeappUploadConfig | undefined
let invalidOutput: boolean

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-'))
  events = []
  failBuild = false
  uploadConfig = { version: ' 2.3.4 ', desc: ' 配置上传说明 ' }
  invalidOutput = false
  state.createContext.mockImplementation(async ({ cliPlatform }) => {
    const platform = cliPlatform ?? 'jd'
    const outDir = path.join(root, 'dist', platform, 'dist')
    const projectPath = path.dirname(outDir)
    return {
      configService: {
        cwd: root,
        platform,
        outDir,
        mpDistRoot: path.relative(root, outDir),
        multiPlatform: { enabled: true },
        packageJson: { name: 'upload-fixture', version: '1.0.0' },
        inlineConfig: {},
        weappViteConfig: { upload: uploadConfig },
        projectConfig: { appid: 'fixture-app' },
        mode: 'production',
      },
      buildService: {
        async build() {
          events.push(`build:${platform}`)
          if (failBuild) {
            throw new Error('compiler rejected source')
          }
          await mkdir(outDir, { recursive: true })
          if (!invalidOutput) {
            await writeFile(path.join(outDir, 'app.json'), '{}')
          }
          await writeFile(path.join(projectPath, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist' }))
        },
      },
      watcherService: { closeAll: () => events.push(`close:${platform}`) },
    }
  })
  state.prepare.mockResolvedValue({ secrets: [], run: vi.fn() })
  state.execute.mockImplementation(async (platform, context) => {
    expect(context.projectPath).toBe(path.join(root, 'dist', platform))
    events.push(`upload:${platform}`)
  })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('build and upload transitions', () => {
  it('builds each selected platform before uploading its IDE project root', async () => {
    await runUploadCommand(root, { platform: 'jd,tt' })
    expect(events).toEqual(['build:jd', 'close:jd', 'upload:jd', 'build:tt', 'close:tt', 'upload:tt'])
  })

  it.each([
    { config: { version: ' 2.3.4 ', desc: ' 配置上传说明 ' }, options: {}, version: '2.3.4', desc: '配置上传说明' },
    { config: { version: '2.3.4', desc: '配置上传说明' }, options: { uv: ' 3.4.5 ', desc: ' CLI 上传说明 ' }, version: '3.4.5', desc: 'CLI 上传说明' },
    { config: undefined, options: {}, version: '1.0.0', desc: 'upload-fixture@1.0.0' },
    { config: { version: '2.3.4' }, options: {}, version: '2.3.4', desc: 'upload-fixture@2.3.4' },
    { config: { version: ' ' }, options: { uv: '3.4.5' }, version: '3.4.5', desc: 'upload-fixture@3.4.5' },
  ])('resolves upload metadata with CLI > config > package precedence: $version / $desc', async ({ config, options, version, desc }) => {
    uploadConfig = config
    await runUploadCommand(root, { platform: 'jd', ...options })
    expect(state.execute).toHaveBeenCalledWith('jd', expect.objectContaining({ version, desc }), [], 'upload')
  })

  it('rejects an explicitly blank configured version before building or uploading', async () => {
    uploadConfig = { version: ' ' }
    await expect(runUploadCommand(root, { platform: 'jd' })).rejects.toThrow('weapp.upload.version')
    expect(events).toEqual(['close:jd'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('does not apply upload-only settings or invoke upload when previewing', async () => {
    uploadConfig = { version: ' ', desc: '仅上传' }
    state.execute.mockResolvedValue({ previewUrl: 'https://example.com/preview' })
    await runUploadCommand(root, { platform: 'jd' }, 'preview')
    expect(state.execute).toHaveBeenCalledWith('jd', expect.objectContaining({
      version: '1.0.0',
      desc: 'upload-fixture@1.0.0',
    }), [], 'preview')
  })

  it('does not upload incomplete build output or start later targets', async () => {
    invalidOutput = true
    await expect(runUploadCommand(root, { platform: 'jd,tt' })).rejects.toThrow('app.json')
    expect(events).toEqual(['build:jd', 'close:jd'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('stops before any upload and closes resources when the compiler fails', async () => {
    failBuild = true
    await expect(runUploadCommand(root, { platform: 'jd,tt' })).rejects.toThrow('compiler rejected source')
    expect(events).toEqual(['build:jd', 'close:jd'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it.each(['upload', 'preview'] as const)('does not load credentials or invoke an SDK in %s dry-run mode', async (action) => {
    state.prepare.mockRejectedValue(new Error('credentials unavailable'))
    await runUploadCommand(root, { platform: 'jd', dryRun: true }, action)
    expect(events).toEqual(['build:jd', 'close:jd'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('does not start later targets after an upload failure', async () => {
    state.execute.mockRejectedValue(new Error('platform rejected upload'))
    await expect(runUploadCommand(root, { platform: 'jd,tt' })).rejects.toThrow('platform rejected upload')
    expect(events).toEqual(['build:jd', 'close:jd'])
  })
})

describe('upload metadata CLI parsing', () => {
  it.each([
    { action: 'upload', args: ['--uv', '00123', '--desc', '12345'], version: '00123', desc: '12345' },
    { action: 'upload', args: ['--desc', '   '], version: '2.3.4', desc: 'upload-fixture@2.3.4' },
    { action: 'upload', args: ['--uv=00123', '--uv=00456', '--desc=000'], version: '00456', desc: '000' },
    { action: 'preview', args: ['--desc', '12345'], version: '1.0.0', desc: '12345' },
  ])('preserves string metadata for $action $args', async ({ action, args, version, desc }) => {
    const cli = cac()
    registerUploadCommand(cli)
    registerPreviewCommand(cli)
    if (action === 'preview') {
      state.execute.mockResolvedValue({ previewUrl: 'https://example.com/preview' })
    }
    cli.parse(['node', 'wv', action, root, '-p', 'jd', ...args], { run: false })
    await cli.runMatchedCommand()
    expect(state.execute).toHaveBeenCalledWith('jd', expect.objectContaining({ version, desc }), [], action)
  })

  it.each([
    { action: 'upload', option: 'uv', args: ['--uv', '1.2.3', '--uv'] },
    { action: 'upload', option: 'uv', args: ['--uv', '1.2.3', '--uv', '--desc', 'release'] },
    { action: 'upload', option: 'uv', args: ['--uv', '--uv', '1.2.3'] },
    { action: 'upload', option: 'desc', args: ['--desc', 'release', '--desc'] },
    { action: 'preview', option: 'desc', args: ['--desc', 'release', '--desc', '--dry-run'] },
  ])('rejects missing repeated $option values before $action can build', async ({ action, option, args }) => {
    const cli = cac()
    registerUploadCommand(cli)
    registerPreviewCommand(cli)
    cli.parse(['node', 'wv', action, root, '-p', 'jd', ...args], { run: false })
    await expect(cli.runMatchedCommand()).rejects.toThrow(`--${option}`)
    expect(state.createContext).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('rejects a whitespace CLI version without falling back to configured metadata', async () => {
    const cli = cac()
    registerUploadCommand(cli)
    cli.parse(['node', 'wv', 'upload', root, '-p', 'jd', '--uv', '   '], { run: false })
    await expect(cli.runMatchedCommand()).rejects.toThrow('weapp.upload.version')
    expect(events).toEqual(['close:jd'])
    expect(state.execute).not.toHaveBeenCalled()
  })
})
