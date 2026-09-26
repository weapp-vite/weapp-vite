import type { InlineConfig } from 'vite'
import type { WeappUploadConfig } from '../../types'
import type * as UploadModule from '../upload/index'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBuildCommand } from './build'

const state = vi.hoisted(() => ({
  createContext: vi.fn(),
  build: vi.fn(),
  webBuild: vi.fn(),
  close: vi.fn(),
  webClose: vi.fn(),
  uploadConfig: vi.fn<() => WeappUploadConfig | undefined>(),
  prepare: vi.fn(),
  execute: vi.fn(),
}))
vi.mock('../../createContext', () => ({ createCompilerContext: state.createContext }))
vi.mock('../upload/index', async importOriginal => ({
  ...await importOriginal<typeof UploadModule>(),
  prepareUpload: state.prepare,
}))
vi.mock('../upload/process', () => ({ executeUpload: state.execute }))
vi.mock('../../logger', () => ({
  default: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  colors: { green: (value: string) => value, bold: (value: string) => value },
}))
vi.mock('../../analyze/subpackages', () => ({ analyzeSubpackages: vi.fn() }))
vi.mock('../../analyze/subpackages/history', () => ({
  readLatestAnalyzeHistorySnapshot: vi.fn(),
  writeAnalyzeHistorySnapshot: vi.fn(),
}))
vi.mock('../analyze/dashboard', () => ({ startAnalyzeDashboard: vi.fn() }))
vi.mock('../logBuildPackageSizeReport', () => ({ logBuildPackageSizeReport: vi.fn() }))
vi.mock('../logBuildAppFinish', () => ({ logBuildAppFinish: vi.fn() }))
vi.mock('../openIde', () => ({ openIde: vi.fn(), resolveIdeProjectPath: vi.fn() }))
vi.mock('../processCleanup', () => ({ terminateStaleSassEmbeddedProcess: vi.fn() }))

let root: string
let events: string[]
let invalidOutput: boolean

async function runBuild(...args: string[]) {
  const cli = cac()
  registerBuildCommand(cli)
  cli.parse(['node', 'wv', 'build', root, ...args], { run: false })
  await cli.runMatchedCommand()
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('VITEST', 'true')
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-build-upload-'))
  events = []
  invalidOutput = false
  state.uploadConfig.mockReturnValue({ version: ' 2.3.4 ', desc: ' 配置上传说明 ' })
  state.createContext.mockImplementation(async ({ inlineConfig = {} }: { inlineConfig?: InlineConfig }) => {
    const outDir = path.resolve(root, inlineConfig.build?.outDir ?? 'dist/jd/dist')
    state.build.mockImplementation(async () => {
      events.push('mini:build')
      await mkdir(outDir, { recursive: true })
      if (!invalidOutput) {
        await writeFile(path.join(outDir, 'app.json'), '{}')
      }
      await writeFile(path.join(path.dirname(outDir), 'project.config.json'), JSON.stringify({
        miniprogramRoot: path.basename(outDir),
      }))
      events.push('mini:built')
      return { output: [] }
    })
    return {
      configService: {
        cwd: root,
        platform: 'jd',
        mode: 'production',
        outDir,
        mpDistRoot: path.relative(root, outDir),
        multiPlatform: { enabled: true },
        packageJson: { name: 'build-upload-fixture', version: '1.0.0' },
        packageManager: { agent: 'pnpm' },
        inlineConfig,
        projectConfig: { appid: 'fixture-app' },
        weappViteConfig: {
          get upload() { return state.uploadConfig() },
          packageSizeWarningBytes: 0,
        },
        weappWebConfig: { enabled: true, outDir: path.join(root, 'dist/web') },
        relativeCwd: (value: string) => path.relative(root, value),
      },
      scanService: { subPackageMap: new Map() },
      buildService: { build: state.build },
      webService: { build: state.webBuild, close: state.webClose },
      watcherService: { closeAll: state.close },
    }
  })
  state.webBuild.mockImplementation(async () => {
    events.push('web:built')
  })
  state.prepare.mockImplementation(async () => {
    events.push('prepare')
    return { secrets: [], run: vi.fn() }
  })
  state.execute.mockImplementation(async () => {
    events.push('upload')
  })
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('build upload opt-in', () => {
  it.each([{ args: [] }, { args: ['--no-upload'] }])('does not consume resolved upload metadata in an ordinary build: $args', async ({ args }) => {
    state.uploadConfig.mockImplementation(() => {
      throw new Error('upload metadata must remain dormant')
    })

    await runBuild(...args)

    expect(events).toEqual(['mini:build', 'mini:built'])
    expect(state.build).toHaveBeenCalledTimes(1)
    expect(state.uploadConfig).not.toHaveBeenCalled()
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('uploads the configured metadata and current output after exactly one build', async () => {
    await runBuild('--upload', '--outDir', 'release/jd/dist', '--minify', 'false', '--skipNpm')

    expect(events).toEqual(['mini:build', 'mini:built', 'prepare', 'upload'])
    expect(state.createContext).toHaveBeenCalledTimes(1)
    expect(state.createContext).toHaveBeenCalledWith(expect.objectContaining({
      inlineConfig: expect.objectContaining({ build: { outDir: 'release/jd/dist', minify: false } }),
    }))
    expect(state.build).toHaveBeenCalledTimes(1)
    expect(state.build).toHaveBeenCalledWith(expect.objectContaining({ skipNpm: true }))
    expect(state.execute).toHaveBeenCalledTimes(1)
    expect(state.execute).toHaveBeenCalledWith('jd', expect.objectContaining({
      projectPath: path.join(root, 'release/jd'),
      version: '2.3.4',
      desc: '配置上传说明',
    }), [], 'upload')
    expect(state.close).toHaveBeenCalledTimes(1)
  })

  it('preserves numeric strings and the last repeated metadata value through CAC', async () => {
    await runBuild('--upload', '--uv', '00123', '--uv=00456', '--desc', '000')

    expect(state.execute).toHaveBeenCalledWith('jd', expect.objectContaining({
      version: '00456',
      desc: '000',
    }), [], 'upload')
  })

  it('waits for both all-target builds and uploads only the configured mini program', async () => {
    let finishWeb!: () => void
    const webFinished = new Promise<void>((resolve) => {
      finishWeb = resolve
    })
    state.webBuild.mockImplementation(async () => {
      events.push('web:build')
      await webFinished
      events.push('web:built')
    })
    const result = runBuild('-p', 'all', '--upload')
    try {
      await vi.waitFor(() => expect(state.webBuild).toHaveBeenCalledTimes(1))
      expect(state.prepare).not.toHaveBeenCalled()
      expect(state.execute).not.toHaveBeenCalled()
    }
    finally {
      finishWeb()
      await result
    }

    expect(events).toEqual(['mini:build', 'mini:built', 'web:build', 'web:built', 'prepare', 'upload'])
    expect(state.createContext).toHaveBeenCalledTimes(1)
    expect(state.build).toHaveBeenCalledTimes(1)
    expect(state.execute).toHaveBeenCalledTimes(1)
    expect(state.execute).toHaveBeenCalledWith('jd', expect.anything(), [], 'upload')
    expect(state.webClose).toHaveBeenCalledTimes(1)
  })

  it.each(['mini', 'web'])('does not prepare credentials or upload when the %s build fails', async (backend) => {
    const error = new Error(`${backend} compiler rejected source`)
    if (backend === 'mini') {
      state.build.mockRejectedValueOnce(error)
    }
    else {
      state.webBuild.mockRejectedValueOnce(error)
    }

    await expect(runBuild('--upload', '-p', backend === 'web' ? 'all' : 'jd')).rejects.toThrow(error)

    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
    expect(state.close).toHaveBeenCalledTimes(1)
  })

  it.each([{ args: [] }, { args: ['--dry-run'] }])('rejects incomplete emitted output before the SDK boundary: $args', async ({ args }) => {
    invalidOutput = true

    await expect(runBuild('--upload', ...args)).rejects.toThrow('app.json')

    expect(events).toEqual(['mini:build', 'mini:built'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
    expect(state.close).toHaveBeenCalledTimes(1)
  })

  it('builds and validates dry-run output without requiring credentials or invoking an SDK', async () => {
    state.prepare.mockRejectedValue(new Error('credentials unavailable'))

    await runBuild('--upload', '--dry-run')

    expect(events).toEqual(['mini:build', 'mini:built'])
    expect(state.build).toHaveBeenCalledTimes(1)
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })
})

describe('build upload CLI guards', () => {
  it.each([
    { args: ['--upload', '--watch'] },
    { args: ['--upload', '-p', 'web'] },
    { args: ['--uv', '1.2.3'] },
    { args: ['--desc', 'release'] },
    { args: ['--dry-run'] },
    { args: ['--no-upload', '--dry-run'] },
  ])('rejects incompatible flags before creating a context: $args', async ({ args }) => {
    await expect(runBuild(...args)).rejects.toThrow()

    expect(state.createContext).not.toHaveBeenCalled()
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it.each([
    { option: 'uv', args: ['--uv', '--uv', '00123'] },
    { option: 'desc', args: ['--desc', 'release', '--desc', '--dry-run'] },
  ])('rejects a missing repeated --$option value before creating a context', async ({ option, args }) => {
    await expect(runBuild('--upload', ...args)).rejects.toThrow(`--${option}`)

    expect(state.createContext).not.toHaveBeenCalled()
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })
})
