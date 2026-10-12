import type { spawnSync } from 'node:child_process'
import type { EnsurePullRequestOptions, EnsureReleaseOptions, GitHubOperations, GitHubRelease } from 'repoctl'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createReleasePullRequest, releaseCi, repairReleaseNotes } from 'repoctl'
import { execSync } from 'tinyexec'
import { vi } from 'vitest'

export type NoteCategory = 'breaking' | 'features' | 'fixes' | 'performance' | 'maintenance' | 'docs' | 'other'

interface ClassificationOptions {
  summary: string | readonly string[]
  bump?: 'patch' | 'minor' | 'major'
  heading?: string
  sourceSubject?: string
  emptyNotes?: boolean
  realVersion?: boolean
}

interface Manifest {
  name: string
  version: string
}

const roots: string[] = []
export const classificationPackage = '@release-classification/library'
const sourceSha = 'a'.repeat(40)

export async function cleanupClassificationFixtures() {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  vi.unstubAllEnvs()
}

/** 按稳定公开标题读取每条包说明所属分类，不依赖生成的内部标识。 */
export function noteCategories(body: string): NoteCategory[] {
  const categories: NoteCategory[] = []
  const titles: Record<string, NoteCategory> = {
    'Breaking Changes': 'breaking',
    'Features': 'features',
    'Bug Fixes': 'fixes',
    'Performance': 'performance',
    'Maintenance': 'maintenance',
    'Documentation': 'docs',
    'Other Changes': 'other',
  }
  let category: NoteCategory | undefined
  for (const line of body.split('\n')) {
    if (/^#{2,3} |^<summary>/.test(line)) {
      category = Object.entries(titles).find(([title]) => line.includes(title))?.[1]
    }
    if (line.startsWith('- **') && line.includes(`${classificationPackage}@`)) {
      if (!category) {
        throw new Error('Release entry has no category heading')
      }
      categories.push(category)
    }
  }
  return categories
}

/** GitHub 和 Git 写入均注入 mock，真实 pnpm 仅可修改本测试临时工作区。 */
export async function createClassificationFixture(options: ClassificationOptions) {
  const cwd = await realpath(await mkdtemp(path.join(tmpdir(), 'repoctl-classification-')))
  roots.push(cwd)
  const rootManifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  const bump = options.bump ?? 'minor'
  const newVersion = { patch: '1.0.1', minor: '1.1.0', major: '2.0.0' }[bump]
  const summaries = typeof options.summary === 'string' ? [options.summary] : options.summary
  const manifestPath = path.join(cwd, 'packages/library/package.json')
  const changelogPath = path.join(cwd, 'packages/library/CHANGELOG.md')
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await mkdir(path.join(cwd, '.changeset'))
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ private: true, packageManager: rootManifest.packageManager }))
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\nversioning:\n  changelog:\n    storage: repository\n')
  await writeFile(manifestPath, JSON.stringify({ name: classificationPackage, version: '1.0.0' }))
  for (const [index, summary] of summaries.entries()) {
    await writeFile(path.join(cwd, `.changeset/update-${index}.md`), `---\n'${classificationPackage}': ${bump}\n---\n\n${summary}\n`)
  }

  const versionCalls: string[][] = []
  const publishCalls: string[][] = []
  const gitCommands: string[][] = []
  const release: GitHubRelease = { id: 1, html_url: 'https://example.test/releases/library', tag_name: `${classificationPackage}@${newVersion}`, body: '' }
  const spawn = ((command: string, args: string[]) => {
    if (command === 'pnpm' && args[0] === 'version') {
      versionCalls.push(args)
      if (options.realVersion) {
        const result = execSync('pnpm', ['--config.manage-package-manager-versions=false', ...args], {
          nodeOptions: { cwd, env: { ...process.env, COREPACK_ENABLE_NETWORK: '0', COREPACK_ENABLE_AUTO_PIN: '0' } },
          timeout: 20_000,
        })
        return { status: result.exitCode ?? 1, stdout: result.stdout, stderr: result.stderr }
      }
      writeFileSync(manifestPath, JSON.stringify({ name: classificationPackage, version: newVersion }))
      const heading = options.heading ?? `${bump[0].toUpperCase()}${bump.slice(1)} Changes`
      const entries = summaries.map(summary => `- ${summary.replaceAll('\n', '\n  ')}`).join('\n\n')
      writeFileSync(changelogPath, `# Changelog\n\n## ${newVersion}\n${options.emptyNotes ? '' : `\n### ${heading}\n\n${entries}\n`}`)
      return { status: 0, stdout: JSON.stringify([{ name: classificationPackage, currentVersion: '1.0.0', newVersion }]), stderr: '' }
    }
    if (command === 'pnpm' && args[0] === 'publish') {
      publishCalls.push(args)
      const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
      writeFileSync(path.join(cwd, 'pnpm-publish-summary.json'), JSON.stringify({ publishedPackages: [pkg] }))
      return { status: 0, stdout: `Published package ${pkg.name}@${pkg.version}`, stderr: '' }
    }
    if (command === 'npm' && args[0] === 'view') {
      const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
      if (args[1] !== `${pkg.name}@${pkg.version}`) {
        throw new Error('Registry mock only accepts the fixture package and version')
      }
      return { status: 0, stdout: args.includes('--json') ? JSON.stringify({ version: pkg.version, gitHead: sourceSha }) : pkg.version, stderr: '' }
    }
    if (command !== 'git') {
      throw new Error(`Unexpected classification command: ${command} ${args.join(' ')}`)
    }
    gitCommands.push(args)
    if (args[0] === 'log') {
      return { status: 0, stdout: sourceSha, stderr: '' }
    }
    if (args[0] === 'show') {
      if (args.includes('-s')) {
        return { status: 0, stdout: `${sourceSha}\x1F${options.sourceSubject ?? 'chore(changeset): 整理发布说明'}\x1F`, stderr: '' }
      }
      if (args.length === 2 && args[1] === `${release.tag_name}:packages/library/CHANGELOG.md`) {
        return { status: 0, stdout: readFileSync(changelogPath, 'utf8'), stderr: '' }
      }
      throw new Error(`Unexpected tagged fixture read: git ${args.join(' ')}`)
    }
    if (args.length === 2 && args[0] === 'rev-parse' && ['--git-dir', 'HEAD'].includes(args[1])) {
      return { status: 0, stdout: args[1] === '--git-dir' ? '.git' : sourceSha, stderr: '' }
    }
    if (args.join(' ') === 'diff --quiet --exit-code') {
      return { status: 1, stdout: '', stderr: '' }
    }
    const expectedMutation = (args[0] === 'config' && args.length === 3 && ['user.name', 'user.email'].includes(args[1]))
      || (args[0] === 'checkout' && args.length === 3 && args[1] === '-B')
      || args.join(' ') === 'add -A'
      || args.join(' ') === 'commit -m chore(release): version packages'
      || (args[0] === 'push' && args.length === 4 && args[1] === '--force' && args[2] === 'origin' && args[3].startsWith('HEAD:'))
    if (expectedMutation) {
      return { status: 0, stdout: '', stderr: '' }
    }
    throw new Error(`Unexpected classification git command: ${args.join(' ')}`)
  }) as typeof spawnSync
  const github = {
    ensurePullRequest: vi.fn(async (_request: EnsurePullRequestOptions) => ({ number: 1, html_url: 'https://example.test/pull/1', state: 'open' })),
    ensureTag: vi.fn(async () => {}),
    ensureRelease: vi.fn(async (request: EnsureReleaseOptions) => ({ ...release, name: request.name, body: request.body })),
    listReleases: vi.fn(async () => [release]),
    updateRelease: vi.fn(async (request: Parameters<NonNullable<GitHubOperations['updateRelease']>>[0]) => ({ ...release, name: request.name, body: request.body })),
  }
  const releaseOptions = { cwd, branch: 'main', config: { qualityScripts: [] }, env: { REPOCTL_LANG: 'en' }, spawn, github }
  return {
    cwd,
    versionCalls,
    publishCalls,
    gitCommands,
    github,
    async manifest() {
      return JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
    },
    changelog: () => readFile(changelogPath, 'utf8'),
    async pullRequestBody() {
      if (!await createReleasePullRequest(releaseOptions)) {
        throw new Error('Release preparation did not create a PR')
      }
      const pkg = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
      release.tag_name = `${pkg.name}@${pkg.version}`
      const body = github.ensurePullRequest.mock.calls.at(-1)?.[0].body
      if (!body) {
        throw new Error('Release preparation produced no PR body')
      }
      return body
    },
    async releaseBody() {
      const result = await repairReleaseNotes({ ...releaseOptions, tag: release.tag_name })
      const body = github.updateRelease.mock.calls.at(-1)?.[0].body
      if (!result.repaired.includes(release.tag_name) || !body) {
        throw new Error('Tagged changelog produced no release body')
      }
      return body
    },
    async publishedReleaseBody() {
      for (const index of summaries.keys()) {
        await rm(path.join(cwd, `.changeset/update-${index}.md`), { force: true })
      }
      await releaseCi({ ...releaseOptions, mode: 'publish' })
      const body = github.ensureRelease.mock.calls.at(-1)?.[0].body
      if (!body) {
        throw new Error('Publish entry produced no GitHub release body')
      }
      return body
    },
  }
}
