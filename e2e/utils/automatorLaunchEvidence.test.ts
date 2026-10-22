import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutomatorLaunchEvidence, serializeLaunchRejection } from './automatorLaunchEvidence'

describe('optional passive launch evidence', () => {
  let directory: string
  let destination: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'automator-launch-evidence-'))
    destination = path.join(directory, 'launch.jsonl')
    vi.stubEnv('WEAPP_VITE_E2E_LAUNCH_EVIDENCE_PATH', destination)
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  function write(file: string, value: unknown) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
  }

  function events(file = destination): Record<string, unknown>[] {
    return fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => {
      const value = JSON.parse(line) as unknown
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Launch evidence event must be an object')
      }
      return value as Record<string, unknown>
    })
  }

  it('does nothing without the explicit local path', () => {
    vi.stubEnv('WEAPP_VITE_E2E_LAUNCH_EVIDENCE_PATH', undefined)
    const evidence = createAutomatorLaunchEvidence(import.meta.url)
    evidence.record('disabled', { actualProjectPath: path.join(directory, 'does-not-exist') })
    expect(evidence.enabled).toBe(false)
    expect(evidence.getFailures()).toEqual([])
    expect(fs.readdirSync(directory)).toEqual([])
    expect(process.stdout.write).not.toHaveBeenCalled()
    expect(process.stderr.write).not.toHaveBeenCalled()
  })

  it('keeps null and undefined rejection distinct and correlates parent and child', () => {
    const parent = createAutomatorLaunchEvidence(import.meta.url)
    const child = createAutomatorLaunchEvidence(import.meta.url, { launchId: parent.launchId })
    parent.record('launch-rejected', { rejection: null })
    child.record('bridge-rejected', { rejection: undefined })
    expect(events()).toMatchObject([
      { launchId: parent.launchId, phase: 'launch-rejected', rejection: { type: 'null', value: null } },
      { launchId: parent.launchId, phase: 'bridge-rejected', rejection: { type: 'undefined' } },
    ])
    expect(events()[1]!.rejection).not.toHaveProperty('value')
    expect(serializeLaunchRejection(new AggregateError([null, undefined], 'first failure'))).toMatchObject({
      type: 'Error',
      name: 'AggregateError',
      message: 'first failure',
      errors: [{ type: 'null', value: null }, { type: 'undefined' }],
    })
  })

  it('uses the actual launch project and public root, preserving both config layers and missing assets', () => {
    const requested = path.join(directory, 'requested-project')
    const actual = path.join(directory, 'launch-project')
    const publicConfig = { miniprogramRoot: 'dist/', libVersion: '3.17.5', compileType: 'miniprogram', setting: { compileHotReLoad: true } }
    write(path.join(requested, 'project.config.json'), { miniprogramRoot: 'other/' })
    write(path.join(actual, 'project.config.json'), publicConfig)
    write(path.join(actual, 'project.private.config.json'), { miniprogramRoot: 'ignored/', libVersion: '3.13.2', condition: { miniprogram: { current: 1, list: [{ id: 1, pathName: 'pages/index/index', query: 'scene=unit', scene: 1001 }] } } })
    write(path.join(actual, 'weapp-vite.config.mjs'), 'export default {}\n')
    write(path.join(actual, 'dist/app.json'), { pages: ['pages/index/index', 'pages/missing/index'], entryPagePath: 'pages/index/index', subPackages: [{ root: 'sub', pages: ['detail/index'], independent: true }] })
    write(path.join(actual, 'dist/pages/index/index.js'), 'Page({})\n')
    write(path.join(actual, 'dist/pages/index/index.wxml'), '<view />\n')
    const evidence = createAutomatorLaunchEvidence(import.meta.url, { requestedProjectPath: requested })
    evidence.record('launch-options-ready', { launchOptions: { projectPath: actual, cwd: actual, timeout: 1234, trustProject: true } })
    const [event] = events()
    expect(event).toMatchObject({
      cwd: process.cwd(),
      requestedProjectPath: requested,
      actualProjectPath: actual,
      sourceModule: { path: fileURLToPath(import.meta.url), status: 'present' },
      launchOptions: { projectPath: actual, cwd: actual, timeout: 1234, trustProject: true },
      inventory: {
        runtimeRoot: path.join(actual, 'dist'),
        runtimeRootSource: path.join(actual, 'project.config.json'),
        publicConfig: { status: 'present', sha256: createHash('sha256').update(JSON.stringify(publicConfig)).digest('hex'), summary: publicConfig },
        privateConfig: { summary: { miniprogramRoot: 'ignored/', libVersion: '3.13.2', condition: { miniprogram: { current: 1, list: [{ id: 1, pathName: 'pages/index/index', query: 'scene=unit', scene: 1001 }] } } } },
        app: { summary: { pages: ['pages/index/index', 'pages/missing/index'], entryPagePath: 'pages/index/index', subPackages: [{ root: 'sub', pages: ['detail/index'], independent: true }] } },
        declaredPages: [
          { route: 'pages/index/index', files: { js: { status: 'present', size: 9 }, json: { status: 'missing' }, wxml: { status: 'present' }, wxss: { status: 'missing' } } },
          { route: 'pages/missing/index', files: { js: { status: 'missing' } } },
          { route: 'sub/detail/index', files: { js: { status: 'missing' } } },
        ],
      },
    })
    expect(evidence.getFailures()).toEqual([])
    expect(fs.readFileSync(path.join(actual, 'project.config.json'), 'utf8')).toBe(JSON.stringify(publicConfig))
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('falls back to the private root and refuses page paths outside the declared output', () => {
    const actual = path.join(directory, 'private-root-project')
    write(path.join(actual, 'project.config.json'), { compileType: 'miniprogram' })
    write(path.join(actual, 'project.private.config.json'), { miniprogramRoot: 'mini/' })
    write(path.join(actual, 'mini/app.json'), { pages: ['../escape'] })
    createAutomatorLaunchEvidence(import.meta.url).record('bridge-project-config-ready', { actualProjectPath: actual })
    expect(events()[0]).toMatchObject({ inventory: {
      runtimeRoot: path.join(actual, 'mini'),
      runtimeRootSource: path.join(actual, 'project.private.config.json'),
      declaredPages: [{ route: '../escape', status: 'invalid-route' }],
    } })
  })

  it('keeps only allowlisted fields and redacts credentials without storing command arguments', () => {
    const actual = path.join(directory, 'redacted-project')
    write(path.join(actual, 'project.config.json'), {
      appid: 'appid-omitted',
      miniprogramRoot: 'dist/',
      token: 'config-token-omitted',
      setting: { compileHotReLoad: true, account: 'setting-account-omitted' },
      condition: { miniprogram: { current: 0, list: [{ id: 0, pathName: 'pages/index/index', query: 'ticket=query-ticket-omitted&safe=yes&access_token=query-token-omitted', account: 'condition-account-omitted' }] } },
    })
    write(path.join(actual, 'dist/app.json'), { pages: [], account: 'app-account-omitted' })
    const rejection = Object.assign(new Error('launch failed ticket=error-ticket-omitted account=error-account-omitted'), { argv: ['--ticket', 'argv-ticket-omitted'], token: 'error-token-omitted' })
    createAutomatorLaunchEvidence(import.meta.url).record('launch-rejected', {
      actualProjectPath: actual,
      rejection,
      selectedInstallation: { cliPath: 'chosen-cli', version: 'stable-version', profileDir: 'profile-omitted', token: 'target-token-omitted' },
      launchOptions: { projectPath: actual, args: ['--auto-account', 'options-account-omitted'], account: 'option-account-omitted', projectConfig: { libVersion: '3.17.5', token: 'patch-token-omitted' } },
    })
    const content = fs.readFileSync(destination, 'utf8')
    expect(content).not.toMatch(/[\w-]+-omitted/)
    expect(content).toContain('safe=yes')
    expect(content).toContain('[redacted]')
    expect(events()[0]).toMatchObject({ selectedInstallation: { cliPath: 'chosen-cli', version: 'stable-version' }, rejection: { name: 'Error', message: 'launch failed ticket=[redacted] account=[redacted]' } })
    expect(serializeLaunchRejection('Command failed: ide --project fixture --ticket hidden')).toEqual({ type: 'string', value: '[command omitted]' })
  })

  it('redacts the complete Authorization value including the Bearer credential', () => {
    const message = 'launch rejected\nAuthorization: Bearer bearer-credential-value\nstatus=denied'
    const rejection = new Error(message)
    createAutomatorLaunchEvidence(import.meta.url).record('launch-rejected', { rejection })
    expect(events()[0]).toMatchObject({ rejection: { message: 'launch rejected\nAuthorization: [redacted]\nstatus=denied' } })
    expect(fs.readFileSync(destination, 'utf8')).not.toContain('bearer-credential-value')
    expect(serializeLaunchRejection('Proxy-Authorization: Basic basic-credential-value')).toEqual({ type: 'string', value: 'Proxy-Authorization: [redacted]' })
    expect(rejection.message).toBe(message)
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('redacts all Cookie pairs and Set-Cookie attributes on the same line', () => {
    const message = 'Cookie: session=session-cookie-value; auth=auth-cookie-value; private=last-cookie-value\nstatus=denied'
    const rejection = new Error(message)
    createAutomatorLaunchEvidence(import.meta.url).record('launch-rejected', { rejection })
    expect(events()[0]).toMatchObject({ rejection: { message: 'Cookie: [redacted]\nstatus=denied' } })
    expect(fs.readFileSync(destination, 'utf8')).not.toMatch(/session-cookie-value|auth-cookie-value|last-cookie-value/)
    expect(serializeLaunchRejection('Set-Cookie: session=set-cookie-value; HttpOnly; Path=/')).toEqual({ type: 'string', value: 'Set-Cookie: [redacted]' })
    expect(rejection.message).toBe(message)
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('retains a write failure separately and leaves the original rejection and stdout untouched', () => {
    const evidence = createAutomatorLaunchEvidence(import.meta.url)
    const original = new Error('original launch failure')
    const secondary = new Error('disk failure token=secondary-secret')
    const append = vi.spyOn(fs, 'appendFileSync').mockImplementationOnce(() => {
      throw secondary
    })
    expect(() => evidence.record('launch-rejected', { rejection: original })).not.toThrow()
    expect(evidence.getFailures()).toEqual([secondary])
    expect(original.message).toBe('original launch failure')
    append.mockRestore()
    evidence.record('launch-rejected', { rejection: original })
    expect(events()[0]).toMatchObject({ rejection: { message: 'original launch failure' }, secondaryFailures: [{ message: 'disk failure token=[redacted]' }] })
    expect(process.stdout.write).not.toHaveBeenCalled()
    expect(vi.mocked(process.stderr.write).mock.calls.flat().join('')).not.toContain('secondary-secret')
  })
})
