import type { ResolvedWechatDevtoolsTarget } from '../src/devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectOpenedAutomator, launchAutomator } from '../src/cli/automator'
import { resolveAutomatorSessionOptions } from '../src/cli/automator/context'
import { prepareAcceptanceProject, runWechatIdeEngineBuild, runWechatIdeEngineBuildByHttp } from '../src/cli/engine'
import { openWechatIdeProjectByHttp } from '../src/cli/http'
import { runWechatCliWithRetry } from '../src/cli/run-login'
import { bootstrapWechatDevtoolsSettings, detectWechatDevtoolsServicePort } from '../src/cli/wechatDevtoolsSettings'
import { resolveWechatDevtoolsTarget } from '../src/devtoolsTarget'
import { createDevtoolsInstallation } from './helpers/devtoolsTarget'

vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => await run() }))
const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
vi.mock('../src/utils', () => ({ execute }))

let root: string
let target: ResolvedWechatDevtoolsTarget
let cliPath: string
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-selection-conflict-'))
  const selected = await createDevtoolsInstallation(root)
  const other = await createDevtoolsInstallation(root, { name: 'other.app' })
  target = await resolveWechatDevtoolsTarget({ cliPath: selected.cliPath, platform: 'darwin', homeDir: root })
  cliPath = other.cliPath
  execute.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await fs.rm(root, { recursive: true, force: true })
})

describe('frozen installation selection across entry points', () => {
  it.each([
    ['HTTP open', () => openWechatIdeProjectByHttp('fixture', { target, cliPath, port: 22001 })],
    ['engine build', () => runWechatIdeEngineBuild('fixture', { target, cliPath })],
    ['HTTP engine build', () => runWechatIdeEngineBuildByHttp('fixture', { target, cliPath })],
    ['acceptance preparation', () => prepareAcceptanceProject('fixture', new AbortController().signal, { target, cliPath })],
    ['settings detection', () => detectWechatDevtoolsServicePort({ target, cliPath })],
    ['settings bootstrap', () => bootstrapWechatDevtoolsSettings({ target, cliPath, trustProject: true, projectPath: 'fixture' })],
    ['native CLI', () => runWechatCliWithRetry(cliPath, ['islogin'], { target })],
    ['automator selection', () => resolveAutomatorSessionOptions({ target, cliPath, projectPath: 'fixture' })],
    ['automator launch', () => launchAutomator({ target, cliPath, projectPath: 'fixture' })],
    ['automator connect', () => connectOpenedAutomator({ target, cliPath, projectPath: 'fixture' })],
  ] as const)('rejects conflicting installation selection before acting: %s', async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    expect(execute).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(await fs.stat(target.profileDir).catch(() => null)).toBeNull()
  })
})
