import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台 pnpm.cmd 解析与有界子进程，符合仓库进程启动约束。
import { execa } from 'execa'
import { createReleasePlan } from 'repoctl'
import { parse } from 'yaml'

interface VersionChange {
  name: string
  currentVersion: string
  newVersion: string
}

export interface NativeProjectionOptions {
  branch?: string
  files: string[]
  readBase: (file: string) => Promise<string | undefined>
}

export interface NativeProjection {
  versions: VersionChange[]
  manifests: Map<string, Record<string, unknown>>
  ledger: unknown
  consumed: string[]
}

function versions(text: string): VersionChange[] {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data) || data.some(item => !item || typeof item.name !== 'string'
    || typeof item.currentVersion !== 'string' || typeof item.newVersion !== 'string')) {
    throw new Error('Invalid native pnpm version plan')
  }
  return data as VersionChange[]
}

/** 在独立元数据副本中复用原生 dry-run 与版本写入；不安装、不共享依赖、不执行任何 hook。 */
export async function projectNativeRelease(options: NativeProjectionOptions): Promise<NativeProjection> {
  if (options.files.some(file => /^\.changeset\/(?:pre|config)\.json$/u.test(file))) {
    throw new Error('Migrate legacy Changesets state to native pnpm versioning before preparing a release')
  }
  const workspaceText = await options.readBase('pnpm-workspace.yaml')
  if (!workspaceText) {
    throw new Error('Base workspace metadata is missing')
  }
  const workspace = parse(workspaceText, { maxAliasCount: 20 }) as { packages?: string[] }
  if (!Array.isArray(workspace.packages) || workspace.packages.some(pattern => typeof pattern !== 'string'
    || path.posix.isAbsolute(pattern.replace(/^!/u, '')) || pattern.split('/').includes('..'))) {
    throw new Error('Base workspace patterns must stay inside the metadata fixture')
  }
  const include = workspace.packages.filter(pattern => !pattern.startsWith('!'))
  const exclude = workspace.packages.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1))
  const manifests = options.files.filter(file => file.endsWith('/package.json')
    && include.some(pattern => path.matchesGlob(path.posix.dirname(file), pattern))
    && !exclude.some(pattern => path.matchesGlob(path.posix.dirname(file), pattern)))
  const intents = options.files.filter(file => /^\.changeset\/[^/]+\.md$/u.test(file) && file !== '.changeset/README.md')
  const inputs = new Set(['package.json', 'pnpm-workspace.yaml', '.changeset/ledger.yaml', ...manifests, ...intents])
  if ([...inputs].some(file => path.posix.isAbsolute(file) || path.posix.normalize(file) !== file || file.split('/').includes('..'))) {
    throw new Error('Native projection inputs must stay inside the metadata fixture')
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'release-intent-metadata-'))
  const originalManifests = new Map<string, Record<string, unknown>>()
  try {
    for (const file of inputs) {
      const source = await options.readBase(file)
      if (source === undefined) {
        continue
      }
      let content = source
      if (file.endsWith('package.json')) {
        const manifest = JSON.parse(source) as Record<string, unknown>
        originalManifests.set(file, manifest)
        const { scripts: _scripts, ...data } = manifest
        content = JSON.stringify(data)
      }
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
      await writeFile(path.join(directory, file), content)
    }
    const pin = /^pnpm@(\d+\.\d+\.\d+)(?:\+sha\d+\.[a-f\d]+)?$/u.exec(String(originalManifests.get('package.json')?.packageManager ?? ''))?.[1]
    if (!pin) {
      throw new Error('Native release projection requires an exact base pnpm pin')
    }
    const environment = { ...process.env, COREPACK_ENABLE_NETWORK: '0', CI: 'true', LEFTHOOK: '0', HUSKY: '0' }
    const run = async (args: string[]) => (await execa('pnpm', args, {
      cwd: directory,
      timeout: 60_000,
      env: environment,
    })).stdout
    if ((await run(['--version'])).trim() !== pin) {
      throw new Error('Native release projection pnpm differs from the base packageManager')
    }
    const native = await createReleasePlan({ cwd: directory, env: environment, config: {}, branch: options.branch ?? 'main' })
    if (native.status === 'blocked') {
      throw new Error(`Native release plan blocked: ${native.blockers.map(item => item.detail).join('; ')}`)
    }
    if (native.status === 'empty') {
      return {
        versions: [],
        manifests: new Map(),
        consumed: [],
        ledger: parse(await options.readBase('.changeset/ledger.yaml') ?? '{}', { maxAliasCount: 20 }),
      }
    }
    const plan = native.packages.map(({ name, currentVersion, newVersion }) => ({ name, currentVersion, newVersion }))
    const applied = versions(await run(['--ignore-scripts', 'version', '-r', '--json'])).sort((a, b) => a.name.localeCompare(b.name))
    if (!isDeepStrictEqual(plan, applied)) {
      throw new Error('Native release projection changed after dry-run')
    }
    const result: NativeProjection = { versions: plan, manifests: new Map(), ledger: {}, consumed: [] }
    for (const file of manifests) {
      const manifest = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Record<string, unknown>
      const original = originalManifests.get(file)!
      if (Object.hasOwn(original, 'scripts')) {
        manifest.scripts = original.scripts
      }
      result.manifests.set(file, manifest)
    }
    result.ledger = parse(await readFile(path.join(directory, '.changeset/ledger.yaml'), 'utf8'), { maxAliasCount: 20 })
    for (const file of intents) {
      if (await readFile(path.join(directory, file), 'utf8').catch(() => undefined) === undefined) {
        result.consumed.push(file)
      }
    }
    return result
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}
