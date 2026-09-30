import type { DoctorReport } from '../../packages/weapp-vite/src/doctor/types'
import { access, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { createIssue1074Project, ISSUE_1074_CLI } from '../utils/issue1074Project'

let project: string
afterEach(async () => {
  if (project) {
    await rm(project, { recursive: true, force: true })
  }
})

describe('issue #1074: real Doctor CLI', () => {
  it('keeps unavailable CLI, listener, login and project connection evidence distinct without starting IDE', async () => {
    project = await createIssue1074Project()
    await writeFile(path.join(project, 'weapp-vite.config.mjs'), 'throw new Error("DO_NOT_EXECUTE")')
    const server = createServer()
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    if (!address || typeof address === 'string') {
      throw new Error('TCP fixture address unavailable')
    }
    const missingCli = path.join(project, 'missing-cli')
    const result = await execa(process.execPath, [ISSUE_1074_CLI, 'doctor', '--runtime', '--runtime-cli', missingCli, '--runtime-login', '--runtime-service-port', String(address.port), '--runtime-port', String(address.port), '--format', 'json'], { cwd: project, reject: false })
    const report = JSON.parse(result.stdout) as DoctorReport
    expect(result.exitCode, result.stderr).toBe(2)
    expect(report.runtime.weapp.facts).toEqual(expect.arrayContaining([
      { stage: 'cli-executable', status: 'failed', code: 'not-executable' },
      { stage: 'service-listener', status: 'failed', code: 'not-listening' },
      { stage: 'login-query', status: 'not-run', code: 'explicit-executable-required' },
      { stage: 'login-state', status: 'unknown', code: 'query-not-run' },
      { stage: 'project-connection', status: 'failed', code: 'connection-failed' },
    ]))
    expect(result.stdout).not.toContain(project)
    expect(result.stdout).not.toContain(missingCli)
    expect(report.runtime.weapp.bundle?.reproduction).toContain('--runtime-cli <selected-cli>')
    expect(report.diagnostics.every(diagnostic => diagnostic.responsibility.owner === 'unknown')).toBe(true)
  })

  it('keeps static inspection read-only and emits clean machine reports', async () => {
    project = await createIssue1074Project()
    const config = path.join(project, 'weapp-vite.config.mjs')
    await writeFile(config, 'throw new Error("DO_NOT_EXECUTE")')
    const result = await execa(process.execPath, [ISSUE_1074_CLI, 'doctor', '--format', 'json'], { cwd: project, reject: false })
    expect(result.exitCode).toBe(0)
    const report = JSON.parse(result.stdout) as DoctorReport
    expect(report.diagnostics).toEqual([])
    await expect(access(path.join(project, '.weapp-vite'))).rejects.toThrow()
    expect(await readFile(config, 'utf8')).toContain('DO_NOT_EXECUTE')
    const failed = await execa(process.execPath, [ISSUE_1074_CLI, 'doctor', '--build', '--format', 'sarif'], { cwd: project, reject: false })
    expect(failed.exitCode).toBe(2)
    expect(JSON.parse(failed.stdout).runs[0].invocations[0].executionSuccessful).toBe(false)
  })

  it('consumes real compiler artifacts and reports final reference errors', async () => {
    project = await createIssue1074Project()
    const args = [ISSUE_1074_CLI, 'doctor', '--build', '--format', 'json']
    const built = await execa(process.execPath, args, { cwd: project, reject: false })
    const report = JSON.parse(built.stdout) as DoctorReport
    expect(report.diagnostics, built.stderr).toEqual([])
    expect(report.exitCode, JSON.stringify(report.coverage)).toBe(0)
    expect(built.exitCode).toBe(0)
    expect(report.artifacts.weapp.files.map(file => file.path)).toEqual(expect.arrayContaining([
      'pages/index/index.js',
      'pages/index/index.wxml',
      'pages/index/index.json',
      'isolated/index.js',
      'isolated/index.wxml',
      'isolated/index.json',
    ]))
    await writeFile(path.join(project, 'src/pages/index/index.wxml'), '<include src="./missing.wxml"/>')
    const broken = await execa(process.execPath, args, { cwd: project, reject: false })
    const brokenReport = JSON.parse(broken.stdout) as DoctorReport
    expect(broken.exitCode).toBe(2)
    expect(brokenReport.artifacts).toEqual({})
    await writeFile(path.join(project, 'src/pages/index/index.wxml'), '<view>ready</view>')
    await writeFile(path.join(project, 'weapp-vite.config.mjs'), `
export default {
  weapp: { srcRoot: 'src' },
  plugins: [{
    name: 'doctor-invalid-final-reference',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName === 'pages/index/index.wxml') {
          file.source = '<include src="./missing.wxml"/>'
        }
      }
    },
  }],
}
`)
    const invalidOutput = await execa(process.execPath, args, { cwd: project, reject: false })
    const invalidReport = JSON.parse(invalidOutput.stdout) as DoctorReport
    expect(invalidOutput.exitCode, JSON.stringify(invalidReport)).toBe(1)
    expect(invalidReport.diagnostics.map(item => item.ruleId)).toContain('doctor/artifact/missing-import')
  }, 120_000)
})
