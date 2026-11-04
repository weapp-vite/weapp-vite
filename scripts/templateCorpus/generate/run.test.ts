import type { GenerationEvidence, GenerationOptions } from './types'
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpusHash } from '../integrity'
import { fileIdentity } from './files'
import { generateFramework } from './run'

const subprocess = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('execa', () => ({ execa: subprocess.run }))

const directories: string[] = []
beforeEach(() => {
  subprocess.run.mockReset()
})
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function fixture(): Promise<GenerationOptions> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-generation-'))
  directories.push(directory)
  const input = path.join(directory, 'input')
  await mkdir(input)
  await writeFile(path.join(input, 'Page.mpx'), '<template><view>安装边界</view></template>')
  return {
    framework: 'mpx',
    version: '2.11.2',
    target: 'wx',
    workspace: path.join(directory, 'generated'),
    input,
    identity: { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'confirmed-test-license' },
    execute: true,
  }
}

async function readReport(directory: string, mode: string): Promise<GenerationEvidence> {
  return JSON.parse(await readFile(path.join(directory, `evidence/${mode}.json`), 'utf8')) as GenerationEvidence
}

function failInstallation(attempt: () => number) {
  subprocess.run.mockImplementation(async (command: string, args: string[] = [], options?: { cwd?: string }) => {
    expect(command).toBe('pnpm')
    if (args[0] === '--version') {
      return { stdout: '12.16.1' }
    }
    expect(args[0]).toBe('install')
    if (!options?.cwd) {
      throw new Error('Missing controlled working directory')
    }
    const log = path.join(options.cwd, `evidence/attempt-${attempt()}/install.log`)
    expect(await readFile(log, 'utf8')).toBe('')
    await expect(open(log, 'wx')).rejects.toMatchObject({ code: 'EEXIST' })
    return { all: `installation failed in attempt ${attempt()}`, exitCode: 1, timedOut: false }
  })
}

describe('immutable generation installation evidence', () => {
  it('runs installation once and shares its immutable failure across both modes', async () => {
    const options = await fixture()
    failInstallation(() => 1)
    const result = await generateFramework(options)
    expect(subprocess.run.mock.calls.filter(([, args]) => args[0] === 'install')).toHaveLength(1)
    expect(result.generations.map(generation => generation.status)).toEqual(['failed', 'failed'])
    const development = await readReport(result.directory, 'development')
    const production = await readReport(result.directory, 'production')
    expect(production.reason).toBe(development.reason)
    const identity = await fileIdentity(result.directory, 'evidence/attempt-1/install.log')
    expect(development.logs).toEqual([identity])
    expect(production.logs).toEqual([identity])
    expect(await readFile(path.join(result.directory, identity.file), 'utf8')).toContain('installation failed in attempt 1')
    expect(development.dependencies).toEqual([])
    expect(production.dependencies).toEqual([])
  })

  it('allocates from sparse directory identities and preserves all previous failure log bytes', async () => {
    const options = await fixture()
    let attempt = 1
    failInstallation(() => attempt)
    const first = await generateFramework(options)
    const firstReport = await readReport(first.directory, 'development')
    const original = await readFile(path.join(first.directory, 'evidence/attempt-1/install.log'))
    await mkdir(path.join(first.directory, 'evidence/attempt-37'))
    attempt = 38
    const second = await generateFramework({ ...options, retry: true })
    expect(second.directory).toBe(first.directory)
    expect(subprocess.run.mock.calls.filter(([, args]) => args[0] === 'install')).toHaveLength(2)
    for (const mode of ['development', 'production']) {
      const report = await readReport(second.directory, mode)
      expect(report.logs).toEqual([await fileIdentity(second.directory, 'evidence/attempt-38/install.log')])
    }
    expect(await readFile(path.join(first.directory, 'evidence/attempt-1/install.log'))).toEqual(original)
    expect(corpusHash(original)).toBe(firstReport.logs[0]!.sha256)
  })

  it('rejects an attempt identity occupied by a regular file before installation', async () => {
    const options = await fixture()
    failInstallation(() => 1)
    const first = await generateFramework(options)
    await writeFile(path.join(first.directory, 'evidence/attempt-51'), 'unrelated file')
    await expect(generateFramework({ ...options, retry: true })).rejects.toThrow('attempt identity must be an ordinary directory')
    expect(subprocess.run.mock.calls.filter(([, args]) => args[0] === 'install')).toHaveLength(1)
  })
})
