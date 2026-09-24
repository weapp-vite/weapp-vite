import type * as UploadModule from '../upload'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runUploadCommand } from './upload'

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

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-'))
  events = []
  failBuild = false
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
          await writeFile(path.join(outDir, 'app.json'), '{}')
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

  it('stops before any upload and closes resources when the compiler fails', async () => {
    failBuild = true
    await expect(runUploadCommand(root, { platform: 'jd,tt' })).rejects.toThrow('compiler rejected source')
    expect(events).toEqual(['build:jd', 'close:jd'])
    expect(state.prepare).not.toHaveBeenCalled()
    expect(state.execute).not.toHaveBeenCalled()
  })

  it('does not load credentials or invoke an uploader in dry-run mode', async () => {
    state.prepare.mockRejectedValue(new Error('credentials unavailable'))
    await runUploadCommand(root, { platform: 'jd', dryRun: true })
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
