import type { UploadCLIOptions } from './options'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { x } from 'tinyexec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareAutoUploadMetadata } from './autoMetadata'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'upload metadata-'))
  const userConfig = path.join(root, 'user.npmrc')
  const globalConfig = path.join(root, 'global.npmrc')
  const gitConfig = path.join(root, 'gitconfig')
  await Promise.all([userConfig, globalConfig, gitConfig].map(file => writeFile(file, '')))
  vi.stubEnv('NPM_CONFIG_USERCONFIG', userConfig)
  vi.stubEnv('NPM_CONFIG_GLOBALCONFIG', globalConfig)
  vi.stubEnv('NPM_CONFIG_CACHE', path.join(root, 'npm-cache'))
  vi.stubEnv('NPM_CONFIG_UPDATE_NOTIFIER', 'false')
  vi.stubEnv('NPM_CONFIG_AUDIT', 'false')
  vi.stubEnv('NPM_CONFIG_FUND', 'false')
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  vi.stubEnv('GIT_CONFIG_GLOBAL', gitConfig)
  vi.stubEnv('GIT_CONFIG_COUNT', '0')
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) {
    vi.stubEnv(key, undefined)
  }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

async function writePackage(cwd: string, manifest: unknown = { name: 'metadata-fixture', version: '1.2.3' }) {
  await mkdir(cwd, { recursive: true })
  await writeFile(path.join(cwd, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('测试清单必须为 JSON 对象。')
  }
  return value as Record<string, unknown>
}

async function versionFiles(cwd: string) {
  return Promise.all(['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].map(async (name) => {
    try {
      return await readFile(path.join(cwd, name), 'utf8')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }))
}

async function git(args: string[], cwd = root) {
  const result = await x('git', args, { nodePath: false, throwOnError: true, nodeOptions: { cwd } })
  return result.stdout.trim()
}

async function initGit(subject = 'fixture release') {
  await git(['init', '--quiet'])
  await git(['config', 'user.name', 'Fixture Author'])
  await git(['config', 'user.email', 'fixture@example.invalid'])
  await git(['config', 'commit.gpgsign', 'false'])
  await git(['config', 'core.hooksPath', path.join(root, 'no-hooks')])
  await git(['add', 'package.json'])
  await git(['commit', '--quiet', '--allow-empty-message', '--cleanup=verbatim', '-m', subject])
}

async function createLock(cwd: string, shrinkwrap = false) {
  await x('npm', ['install', '--package-lock-only', '--ignore-scripts', '--offline', '--workspaces=false', '--prefix', cwd], {
    nodePath: false,
    throwOnError: true,
    nodeOptions: { cwd },
  })
  if (shrinkwrap) {
    await x('npm', ['shrinkwrap', '--ignore-scripts', '--offline', '--workspaces=false', '--prefix', cwd], {
      nodePath: false,
      throwOnError: true,
      nodeOptions: { cwd },
    })
  }
}

describe('prepareAutoUploadMetadata', () => {
  it('does no manifest or tool work when automatic metadata is inactive', async () => {
    vi.stubEnv('PATH', root)
    const options = { uv: 'manual', desc: 'manual description', dryRun: true }
    expect(await prepareAutoUploadMetadata(path.join(root, 'absent'), options, 'upload')).toBe(options)
    expect(await prepareAutoUploadMetadata(path.join(root, 'absent'), options, 'preview')).toBe(options)
  })

  it.each<UploadCLIOptions>([
    { bump: 'patch' },
    { gitDesc: true },
    { gitDesc: false },
  ])('rejects preview automatic options without modifying files: %j', async (options) => {
    await writePackage(root)
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(root, options, 'preview')).rejects.toThrow(/preview/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it.each<UploadCLIOptions>([
    { bump: 'patch', uv: '' },
    { bump: 'patch', gitDesc: true, desc: '' },
    { bump: 'prerelease' },
    { bump: '' },
    { bump: ' patch ' },
  ])('rejects conflicts and invalid releases before mutation: %j', async (options) => {
    await writePackage(root)
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(root, options, 'upload')).rejects.toThrow(/--bump|--git-desc/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing version', {}],
    ['numeric version', { version: 123 }],
    ['empty version', { version: '' }],
    ['incomplete version', { version: '1.2' }],
    ['invalid version', { version: 'not-semver' }],
  ])('rejects %s manifests without mutation', async (_name, manifest) => {
    await writePackage(root, manifest)
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(root, { bump: 'patch' }, 'upload')).rejects.toThrow(/version/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it('rejects malformed JSON without rewriting it', async () => {
    await writeFile(path.join(root, 'package.json'), '{ invalid JSON\n')
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(root, { bump: 'patch' }, 'upload')).rejects.toThrow(/package\.json/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it('does not find or bump a parent manifest when the command root has none', async () => {
    await writePackage(root)
    const cwd = path.join(root, 'nested')
    await mkdir(cwd)
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(cwd, { bump: 'patch' }, 'upload')).rejects.toThrow(/package\.json/)
    expect(await versionFiles(root)).toEqual(before)
    expect(await versionFiles(cwd)).toEqual([null, null, null])
  })

  it.each([
    ['1.2.3', 'patch', '1.2.4'],
    ['1.2.3', 'minor', '1.3.0'],
    ['1.2.3', 'major', '2.0.0'],
    ['1.2.3-beta.2', 'patch', '1.2.3'],
    ['1.2.3-beta.2', 'minor', '1.3.0'],
    ['1.2.3-beta.2', 'major', '2.0.0'],
    ['2.0.0-beta.2', 'major', '2.0.0'],
    ['1.3.0-beta.2', 'minor', '1.3.0'],
  ])('applies npm-compatible %s %s → %s', async (version, bump, expected) => {
    await writePackage(root, { name: 'metadata-fixture', version })
    const options = { bump }
    const metadata = await prepareAutoUploadMetadata(root, options, 'upload')
    expect(metadata.uv).toBe(expected)
    expect((await readJson(path.join(root, 'package.json'))).version).toBe(expected)
    expect(options).toEqual({ bump })
  })

  it('preserves subject Unicode, interior whitespace and shell text but trims its edges', async () => {
    await writePackage(root)
    const subject = '  发布 "quoted"  $(touch injected) & %PATH% `touch injected` \'literal\'  '
    await initGit(subject)
    await git(['commit', '--quiet', '--allow-empty', '--cleanup=verbatim', '-m', ` ${subject} latest `])
    await rm(path.join(root, 'package.json'))
    const result = await prepareAutoUploadMetadata(root, { gitDesc: true }, 'upload')
    expect(result.desc).toBe(`${subject} latest`.trim())
    expect(await readdir(root)).not.toContain('injected')
    expect(await versionFiles(root)).toEqual([null, null, null])
  })

  it.each(['not a repository', 'no commits', 'empty subject'])('resolves Git %s errors before a bump', async (state) => {
    await writePackage(root)
    if (state === 'no commits') {
      await git(['init', '--quiet'])
    }
    if (state === 'empty subject') {
      await initGit('')
    }
    const before = await versionFiles(root)
    await expect(prepareAutoUploadMetadata(root, { bump: 'patch', gitDesc: true }, 'upload')).rejects.toThrow(/--git-desc/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it('reports an unavailable npm without changing version files', async () => {
    await writePackage(root)
    const before = await versionFiles(root)
    vi.stubEnv('PATH', root)
    await expect(prepareAutoUploadMetadata(root, { bump: 'patch' }, 'upload')).rejects.toThrow(/npm version/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it('reports a real npm configuration failure without changing version files', async () => {
    await writePackage(root)
    const before = await versionFiles(root)
    vi.stubEnv('NPM_CONFIG_GLOBALCONFIG', path.join(root, 'user.npmrc'))
    await expect(prepareAutoUploadMetadata(root, { bump: 'patch' }, 'upload')).rejects.toThrow(/npm version/)
    expect(await versionFiles(root)).toEqual(before)
  })

  it.each([false, true])('dry-run projects metadata without npm or source/lock mutation (shrinkwrap=%s)', async (shrinkwrap) => {
    await writePackage(root)
    await createLock(root, shrinkwrap)
    const before = await versionFiles(root)
    vi.stubEnv('PATH', root)
    const result = await prepareAutoUploadMetadata(root, { bump: 'minor', dryRun: true }, 'upload')
    expect(result.uv).toBe('1.3.0')
    expect((await readJson(path.join(root, 'package.json'))).version).toBe('1.2.3')
    expect(await versionFiles(root)).toEqual(before)
  })

  it.each([false, true])('updates lockfile semantics without lifecycle scripts or Git changes (shrinkwrap=%s)', async (shrinkwrap) => {
    await writePackage(root, {
      name: 'metadata-fixture',
      version: '1.2.3',
      scripts: { preversion: 'node lifecycle.cjs', version: 'node lifecycle.cjs', postversion: 'node lifecycle.cjs' },
    })
    await writeFile(path.join(root, 'lifecycle.cjs'), 'require("node:fs").writeFileSync("lifecycle-ran", "yes"); process.exit(91)\n')
    await createLock(root, shrinkwrap)
    await initGit()
    await git(['tag', 'fixture-baseline'])
    const head = await git(['rev-parse', 'HEAD'])
    const tags = await git(['show-ref', '--tags'])
    const result = await prepareAutoUploadMetadata(root, { bump: 'patch', gitDesc: true }, 'upload')
    expect(result.uv).toBe('1.2.4')
    expect(result.desc).toBe('fixture release')
    expect((await readJson(path.join(root, 'package.json'))).version).toBe('1.2.4')
    const lock = await readJson(path.join(root, shrinkwrap ? 'npm-shrinkwrap.json' : 'package-lock.json'))
    expect(lock).toMatchObject({ version: '1.2.4', packages: { '': { name: 'metadata-fixture', version: '1.2.4' } } })
    expect(await readdir(root)).not.toContain('lifecycle-ran')
    expect(await git(['rev-parse', 'HEAD'])).toBe(head)
    expect(await git(['show-ref', '--tags'])).toBe(tags)
  })

  it('bumps the exact nested workspace package, never its owning root or sibling', async () => {
    await writePackage(root, { name: 'workspace-fixture', private: true, version: '9.0.0', workspaces: ['packages/*'] })
    const cwd = path.join(root, 'packages', 'target package')
    const sibling = path.join(root, 'packages', 'sibling')
    await writePackage(cwd)
    await writePackage(sibling, { name: 'sibling-fixture', version: '4.0.0' })
    await createLock(root)
    await createLock(cwd)
    const parentBefore = await versionFiles(root)
    const siblingBefore = await versionFiles(sibling)
    const result = await prepareAutoUploadMetadata(cwd, { bump: 'major' }, 'upload')
    expect(result.uv).toBe('2.0.0')
    expect((await readJson(path.join(cwd, 'package.json'))).version).toBe('2.0.0')
    expect(await readJson(path.join(cwd, 'package-lock.json'))).toMatchObject({ version: '2.0.0', packages: { '': { version: '2.0.0' } } })
    expect(await versionFiles(root)).toEqual(parentBefore)
    expect(await versionFiles(sibling)).toEqual(siblingBefore)
  })
})
