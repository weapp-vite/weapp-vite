import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { hasNativeProfileEntry, NATIVE_PROFILE_FIXTURE, saveNativeProfileSource } from '../utils/nativeProfileProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const PAGE = 'pages/plain/index.js'
const PROFILE = 'reports/hmr-profile.jsonl'
const QUIET_WINDOW_MS = 5_000

interface ProfileRecord {
  status: string
  sourceEvents?: { file?: string }[]
}

async function readProfiles(project: string): Promise<ProfileRecord[]> {
  let content: string
  try {
    content = await readFile(path.join(project, PROFILE), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
  return content.split(/\r?\n/).filter(Boolean).map((line) => {
    const record = JSON.parse(line) as Partial<ProfileRecord>
    expect(record.status).toEqual(expect.any(String))
    return record as ProfileRecord
  })
}

async function createProject() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'profile-recovery-'))
  try {
    await cp(path.join(ROOT, NATIVE_PROFILE_FIXTURE), project, { recursive: true })
    await mkdir(path.join(project, 'node_modules'))
    // 对照实验可显式选择已构建的包；默认始终验证当前仓库的 dist。
    const packageRoot = await realpath(process.env.WEAPP_VITE_E2E_PROFILE_PACKAGE_ROOT ?? path.join(ROOT, 'packages/weapp-vite'))
    await symlink(packageRoot, path.join(project, 'node_modules/weapp-vite'), 'junction')
    await symlink(await realpath(path.join(packageRoot, 'node_modules/vite')), path.join(project, 'node_modules/vite'), 'junction')
    await writeFile(path.join(project, 'src', PAGE), 'Page({ data: { value: \'broken-initial\' }\n')
    await writeFile(path.join(project, 'profile-host.mjs'), [
      'import process from \'node:process\'',
      'import path from \'node:path\'',
      'import { createServer } from \'vite\'',
      'import { weapp } from \'weapp-vite/vite\'',
      'import config from \'./weapp-vite.config.ts\'',
      'const server = await createServer({',
      '  ...config, configFile: false, plugins: [weapp()],',
      '  server: { host: \'127.0.0.1\', port: 0, watch: { usePolling: true, interval: 120 } },',
      '})',
      'let closing',
      'const close = () => closing ??= server.close().then(() => {',
      '  console.log(\'PROFILE_RECOVERY_HOST_CLOSED\')',
      '})',
      'process.once(\'disconnect\', () => void close())',
      'process.once(\'SIGTERM\', () => void close())',
      'await server.listen()',
      'console.log(JSON.stringify({ scenario: \'profile-recovery-host\', watchRoot: path.relative(process.cwd(), server.config.root) || \'.\' }))',
      'console.log(\'PROFILE_RECOVERY_HOST_READY\')',
    ].join('\n'))
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

describe('profile output ownership after a failed borrowed-host build', () => {
  it('keeps custom failed diagnostics quiet and recovers on the next source edit', async (context) => {
    const project = await createProject()
    const dev = startDevProcess(process.execPath, ['profile-host.mjs'], {
      cwd: project,
      env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: PROFILE },
      all: true,
      ipc: true,
    })
    context.onTestFailed(() => process.stdout.write(dev.getOutput()))
    try {
      await dev.waitForOutput('PROFILE_RECOVERY_HOST_READY', 'borrowed host retains failed initial build', 30_000)
      expect(dev.getOutput()).toMatch(/Parse failure|PARSE_ERROR|Unexpected token|Expected.*but found/)
      expect(await hasNativeProfileEntry(project, 'pages/plain/index')).not.toEqual([true, true, true])

      const beforeEdit = await readProfiles(project)
      await saveNativeProfileSource(project, PAGE, 'Page({ data: { value: \'broken-edit\' }\n')
      const pageFile = path.join(project, 'src', PAGE).replaceAll('\\', '/')
      await dev.waitFor(expect.poll(async () => (await readProfiles(project)).slice(beforeEdit.length).some(record => record.status === 'failed' && record.sourceEvents?.some(event => event.file === pageFile)), { timeout: 30_000 }).toBe(true), 'failed source recovery profile')
      const afterFailure = await readProfiles(project)
      expect(afterFailure.at(-1)?.status).toBe('failed')

      // 持续观察多个 polling 周期，避免“首次记录已写出”掩盖紧随其后的自触发。
      const failedCount = afterFailure.length
      const deadline = Date.now() + QUIET_WINDOW_MS
      let quiet = true
      while (Date.now() < deadline) {
        await delay(100)
        if (JSON.stringify(await readProfiles(project)) !== JSON.stringify(afterFailure)) {
          quiet = false
          break
        }
      }
      expect.soft(quiet, 'profile output must not trigger another failed snapshot without a source edit').toBe(true)
      const beforeRecovery = await readProfiles(project)

      await saveNativeProfileSource(project, PAGE, 'Page({ data: { value: \'profile-recovery-complete\' } })\n')
      await dev.waitFor(expect.poll(() => readFile(path.join(project, 'dist', PAGE), 'utf8'), { timeout: 30_000 }).toContain('profile-recovery-complete'), 'recovered page output')
      await dev.waitForOutput('小程序开发产物已就绪', 'borrowed host reports successful recovery')
      expect(await hasNativeProfileEntry(project, 'pages/plain/index')).toEqual([true, true, true])

      // 首次成功发布沿用初次构建语义；再验证正常 HMR 及其 complete 记录仍然生效。
      await saveNativeProfileSource(project, PAGE, 'Page({ data: { value: \'profile-normal-edit\' } })\n')
      await dev.waitFor(expect.poll(() => readFile(path.join(project, 'dist', PAGE), 'utf8'), { timeout: 30_000 }).toContain('profile-normal-edit'), 'normal source edit after recovery')
      await dev.waitFor(expect.poll(async () => (await readProfiles(project)).some(record => record.status === 'complete'), { timeout: 30_000 }).toBe(true), 'normal HMR profile after recovery')
      const recovered = await readProfiles(project)
      expect(recovered.length).toBeGreaterThan(beforeRecovery.length)
      await delay(QUIET_WINDOW_MS)
      const finalProfiles = await readProfiles(project)
      expect.soft(finalProfiles, 'recovered host stays quiet without source edits').toEqual(recovered)
      const unexpectedInputs = finalProfiles.flatMap(record => record.sourceEvents ?? []).filter(event => event.file === path.join(project, PROFILE).replaceAll('\\', '/'))
      expect.soft(unexpectedInputs, 'diagnostics must never become source events').toEqual([])
      process.stdout.write(`${JSON.stringify({ scenario: 'profile-failed-recovery', quiet, beforeEdit: beforeEdit.length, failedCount, beforeRecovery: beforeRecovery.length, recovered: recovered.length, final: finalProfiles.length, profileSourceEvents: unexpectedInputs.length, records: finalProfiles.map(record => ({ status: record.status, inputs: (record.sourceEvents ?? []).map(event => event.file ? path.relative(project, event.file).replaceAll('\\', '/') : null) })) })}\n`)
    }
    finally {
      await dev.stop(5_000)
      await dev.stop(5_000)
      await rm(project, { recursive: true, force: true })
      await expect(access(project)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(dev.getOutput()).toContain('PROFILE_RECOVERY_HOST_CLOSED')
      if (dev.pid !== undefined) {
        expect(() => process.kill(dev.pid!, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
      }
      process.stdout.write(`${JSON.stringify({ scenario: 'profile-failed-recovery-cleanup', hostClosed: true, processReleased: true, fixtureRemoved: true, repeatedStop: true })}\n`)
    }
  }, 120_000)
})
