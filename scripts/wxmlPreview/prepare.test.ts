import type { Fetcher } from './contract.ts'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { confirmPreview } from './confirm.ts'
import { archiveIntegrity, PACKAGE_ENDPOINT, PACKAGE_NAME, REGISTRY } from './contract.ts'
import { preparePreview } from './prepare.ts'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
let root: string
let directory: string
let packageFile: string
let original: Buffer
let env: NodeJS.ProcessEnv
const archive = Buffer.from('npm pack archive bytes')
const version = '0.1.0-alpha.0'

function registry(options: { exists?: boolean, latest?: string, published?: boolean, integrity?: string } = {}): Fetcher {
  return vi.fn(async (input: Parameters<Fetcher>[0]) => {
    const url = String(input)
    if (url === `${PACKAGE_ENDPOINT}/${version}`) {
      if (!options.exists && !options.published) {
        return new Response('{}', { status: 404 })
      }
      return Response.json({ name: PACKAGE_NAME, version, dist: { integrity: options.integrity ?? archiveIntegrity(archive), attestations: { url: `${REGISTRY}/-/npm/v1/attestations/wxml`, provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } } })
    }
    expect(url).toBe(PACKAGE_ENDPOINT)
    return Response.json({ 'dist-tags': { ...(options.latest ? { latest: options.latest } : {}), ...(options.published ? { alpha: version } : {}) } })
  }) as Fetcher
}

beforeEach(async () => {
  execute.mockReset()
  root = await mkdtemp(path.join(os.tmpdir(), 'wxml-preview-'))
  directory = path.join(root, 'packages/wxml')
  packageFile = path.join(directory, 'package.json')
  await mkdir(path.join(directory, 'dist'), { recursive: true })
  await mkdir(path.join(root, 'runner'))
  await writeFile(path.join(directory, 'dist/index.mjs'), 'export const parse = () => {}\n')
  await writeFile(path.join(directory, 'dist/index.d.mts'), 'export declare const parse: () => void\n')
  await writeFile(path.join(directory, 'README.md'), '# WXML\n')
  original = Buffer.from(`${JSON.stringify({ name: PACKAGE_NAME, version: '0.0.0', files: ['README.md', 'dist'], main: './dist/index.mjs', types: './dist/index.d.mts', exports: { '.': { types: './dist/index.d.mts', import: './dist/index.mjs' }, './package.json': './package.json' }, publishConfig: { access: 'public', registry: REGISTRY } })}\n`)
  await writeFile(packageFile, original)
  env = { PREVIEW_VERSION: version, RUNNER_TEMP: path.join(root, 'runner'), GITHUB_SHA: 'a'.repeat(40), GITHUB_OUTPUT: path.join(root, 'output'), GITHUB_STEP_SUMMARY: path.join(root, 'summary') }
  execute.mockImplementation(async (_command: string, args: string[], options: { cwd: string }) => {
    expect(options.cwd).toBe(directory)
    const destination = args[args.length - 1]!
    const files = await Promise.all(['README.md', 'package.json', 'dist/index.mjs', 'dist/index.d.mts'].map(async filename => ({ path: filename, size: (await readFile(path.join(directory, filename))).length })))
    const filename = `weapp-vite-wxml-${version}.tgz`
    await writeFile(path.join(destination, filename), archive)
    return { stdout: JSON.stringify([{ name: PACKAGE_NAME, version, filename, size: archive.length, integrity: archiveIntegrity(archive), files }]) }
  })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('packs only WXML with scripts disabled, records real archive bytes and restores the source manifest', async () => {
  const result = await preparePreview({ root, env, fetcher: registry({ latest: '0.0.0-oidc-init' }) })
  expect(execute).toHaveBeenCalledWith('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', path.join(env.RUNNER_TEMP!, 'wxml-preview')], { cwd: directory })
  expect(await readFile(packageFile)).toEqual(original)
  expect(result.metadata).toMatchObject({ name: PACKAGE_NAME, version, tag: 'alpha', sourceSha: env.GITHUB_SHA, integrity: archiveIntegrity(archive), latestBefore: '0.0.0-oidc-init' })
  expect(result.metadata.dist).toHaveLength(2)
  expect(await readFile(env.GITHUB_OUTPUT!, 'utf8')).toBe(`tarball=${result.tarball}\nmanifest=${result.manifest}\n`)
})

it('refuses an existing preview before changing package bytes or packing', async () => {
  await expect(preparePreview({ root, env, fetcher: registry({ exists: true }) })).rejects.toThrow('already exists')
  expect(execute).not.toHaveBeenCalled()
  expect(await readFile(packageFile)).toEqual(original)
})

it('restores the original package bytes after npm pack fails', async () => {
  execute.mockRejectedValueOnce(new Error('pack failed'))
  await expect(preparePreview({ root, env, fetcher: registry() })).rejects.toThrow('pack failed')
  expect(await readFile(packageFile)).toEqual(original)
})

it('rejects an archive with missing dist and still restores the manifest', async () => {
  const valid = execute.getMockImplementation()!
  execute.mockImplementationOnce(async (...args: unknown[]) => {
    const result = await valid(...args)
    const value = JSON.parse(result.stdout) as { files: { path: string }[] }[]
    value[0]!.files = value[0]!.files.filter(file => file.path !== 'dist/index.d.mts')
    return { stdout: JSON.stringify(value) }
  })
  await expect(preparePreview({ root, env, fetcher: registry() })).rejects.toThrow('complete existing tsdown dist')
  expect(await readFile(packageFile)).toEqual(original)
})

it('confirms the exact published bytes without creating latest and emits a metadata-only provenance summary', async () => {
  const prepared = await preparePreview({ root, env, fetcher: registry() })
  const result = await confirmPreview({ manifest: prepared.manifest, env, fetcher: registry({ published: true }) })
  expect(result.confirmation).toMatchObject({ version, sourceSha: env.GITHUB_SHA, latest: null, latestUnchanged: true, provenanceVerification: 'metadata-only' })
  expect(await readFile(env.GITHUB_STEP_SUMMARY!, 'utf8')).toContain(`npm install ${PACKAGE_NAME}@${version}`)
  expect(result.summary).toContain('Sigstore')
})

it('refuses registry drift or local archive substitution before writing confirmation', async () => {
  const prepared = await preparePreview({ root, env, fetcher: registry() })
  await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry({ published: true, latest: version }) })).rejects.toThrow('latest changed')
  await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry({ published: true, integrity: archiveIntegrity(Buffer.from('other archive')) }) })).rejects.toThrow('integrity')
  await writeFile(prepared.tarball, 'substituted')
  await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry({ published: true }) })).rejects.toThrow('Local archive changed')
})

it('waits only for bounded registry propagation without repacking or republishing', async () => {
  const prepared = await preparePreview({ root, env, fetcher: registry() })
  const ready = registry({ published: true })
  const wait = vi.fn(async () => {})
  let round = 0
  const fetcher: Fetcher = async (input, options) => {
    if (String(input) === `${PACKAGE_ENDPOINT}/${version}`) {
      round++
      if (round === 1) {
        return new Response('{}', { status: 404 })
      }
      if (round === 3) {
        return Response.json({ name: PACKAGE_NAME, version, dist: { integrity: archiveIntegrity(archive) } })
      }
    }
    else if (round === 2) {
      return Response.json({ 'dist-tags': { alpha: '0.1.0-alpha.1' } })
    }
    return ready(input, options)
  }
  const result = await confirmPreview({ manifest: prepared.manifest, env, fetcher, wait })
  expect(result.confirmation.registryConfirmationAttempts).toBe(4)
  expect(wait).toHaveBeenCalledTimes(3)
  expect(wait).toHaveBeenCalledWith(5_000)
  expect(execute).toHaveBeenCalledTimes(1)
})

it('fails after the fixed confirmation limit and fails integrity drift immediately', async () => {
  const prepared = await preparePreview({ root, env, fetcher: registry() })
  const wait = vi.fn(async () => {})
  await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry(), wait })).rejects.toThrow('after 6 attempts')
  expect(wait).toHaveBeenCalledTimes(5)
  wait.mockClear()
  await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry({ published: true, integrity: archiveIntegrity(Buffer.from('other archive')) }), wait })).rejects.toThrow('integrity')
  expect(wait).not.toHaveBeenCalled()
  expect(execute).toHaveBeenCalledTimes(1)
})

it('stops confirmation at its deadline without attempting another publish', async () => {
  const prepared = await preparePreview({ root, env, fetcher: registry() })
  let now = 0
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
  const wait = vi.fn(async () => {
    now += 60_000
  })
  try {
    await expect(confirmPreview({ manifest: prepared.manifest, env, fetcher: registry(), wait })).rejects.toThrow('60-second deadline')
    expect(wait).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(1)
  }
  finally {
    clock.mockRestore()
  }
})
