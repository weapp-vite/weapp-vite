import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { isReleaseWorthyWorkspaceFile } from '../check-publishable-workspace-changeset'
import { projectNativeRelease } from './nativeProjection'
import { collectPreparedReleasePackages } from './prepared'

it('accepts actual pnpm fixed/dependency propagation without fabricating per-package ledger entries', async () => {
  const root = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  const scripts = { preversion: 'node -e "throw new Error(\'hooks must not run\')"', postversion: 'exit 42' }
  const before = new Map<string, string>([
    ['package.json', JSON.stringify({ name: 'fixture', private: true, packageManager: root.packageManager, scripts })],
    ['pnpm-workspace.yaml', 'packages: [packages/*]\nversioning:\n  fixed: [[core, fixed]]\n  changelog:\n    storage: repository\n'],
    ['.changeset/ledger.yaml', '{}'],
    ['.changeset/change.md', '---\ncore: major\n---\n\nfeat!: 调整接口\n'],
  ])
  const packages = ['core', 'fixed', 'consumer', 'ranged'].map(name => ({ name, dir: `packages/${name}`, localWorkspaceDependencies: [] }))
  for (const pkg of packages) {
    const dependencies = pkg.name === 'consumer' ? { core: 'workspace:*' } : {}
    const peerDependencies = pkg.name === 'ranged' ? { core: 'workspace:^' } : {}
    before.set(`${pkg.dir}/package.json`, JSON.stringify({ name: pkg.name, version: '1.0.0', dependencies, peerDependencies, scripts }))
    before.set(`${pkg.dir}/CHANGELOG.md`, `# ${pkg.name}\n\n## 1.0.0\n\n旧记录\n`)
  }
  const readBase = async (file: string) => before.get(file)
  const projection = await projectNativeRelease({ files: [...before.keys()], readBase })
  expect(projection.versions).toEqual([
    { name: 'consumer', currentVersion: '1.0.0', newVersion: '1.0.1' },
    { name: 'core', currentVersion: '1.0.0', newVersion: '2.0.0' },
    { name: 'fixed', currentVersion: '1.0.0', newVersion: '2.0.0' },
    { name: 'ranged', currentVersion: '1.0.0', newVersion: '1.0.0' },
  ])
  expect(projection.ledger).toEqual({ 'core@2.0.0': { dir: 'packages/core', intents: ['change'] } })
  expect(projection.manifests.get('packages/ranged/package.json')?.peerDependencies).toEqual({ core: 'workspace:^' })
  expect(projection.manifests.get('packages/core/package.json')?.scripts).toEqual(scripts)
  expect(JSON.parse(before.get('packages/core/package.json')!).version).toBe('1.0.0')
  const after = new Map(before)
  after.delete('.changeset/change.md')
  after.set('.changeset/ledger.yaml', JSON.stringify(projection.ledger))
  const changedPackages = packages.filter(pkg => projection.versions.some(entry => entry.name === pkg.name && entry.currentVersion !== entry.newVersion))
  for (const pkg of changedPackages) {
    const manifest = projection.manifests.get(`${pkg.dir}/package.json`)!
    after.set(`${pkg.dir}/package.json`, JSON.stringify(manifest))
    after.set(`${pkg.dir}/CHANGELOG.md`, `# ${pkg.name}\n\n## ${manifest.version}\n\n新记录\n\n## 1.0.0\n\n旧记录\n`)
  }
  const options = {
    headRef: 'release/pnpm-version',
    packages,
    changedFiles: changedPackages.flatMap(pkg => [`${pkg.dir}/package.json`, `${pkg.dir}/CHANGELOG.md`]),
    isReleaseWorthy: isReleaseWorthyWorkspaceFile,
    project: async () => projection,
    readBase,
    readHead: async (file: string) => after.get(file),
  }
  expect([...(await collectPreparedReleasePackages(options))]).toEqual(changedPackages.map(pkg => pkg.name))
  const consumer = JSON.parse(after.get('packages/consumer/package.json')!) as { dependencies: Record<string, string> }
  consumer.dependencies.core = 'workspace:^9.0.0'
  after.set('packages/consumer/package.json', JSON.stringify(consumer))
  expect(await collectPreparedReleasePackages(options)).not.toContain('consumer')
}, 30_000)

it('preserves native prerelease lanes from workspace metadata and rejects unmigrated legacy state', async () => {
  const root = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { packageManager: string }
  const before = new Map([
    ['package.json', JSON.stringify({ name: 'fixture', private: true, packageManager: root.packageManager })],
    ['pnpm-workspace.yaml', 'packages: [packages/*]\nversioning:\n  lanes: {core: alpha}\n  changelog: {storage: repository}\n'],
    ['.changeset/ledger.yaml', '{}'],
    ['.changeset/change.md', '---\ncore: minor\n---\n\nfeat: 增加能力\n'],
    ['packages/core/package.json', '{"name":"core","version":"1.0.0"}'],
    ['packages/core/CHANGELOG.md', '# core\n\n## 1.0.0\n\n旧记录\n'],
  ])
  const readBase = async (file: string) => before.get(file)
  const projection = await projectNativeRelease({ files: [...before.keys()], readBase, branch: 'alpha' })
  const version = projection.versions[0]!.newVersion
  expect(version).toMatch(/-alpha\.\d+$/u)
  const after = new Map(before)
  for (const file of projection.consumed) {
    after.delete(file)
  }
  after.set('.changeset/ledger.yaml', JSON.stringify(projection.ledger))
  after.set('packages/core/package.json', JSON.stringify(projection.manifests.get('packages/core/package.json')))
  after.set('packages/core/CHANGELOG.md', `# core\n\n## ${version}\n\n预发布\n\n## 1.0.0\n\n旧记录\n`)
  expect(await collectPreparedReleasePackages({
    headRef: 'release/pnpm-version-alpha',
    packages: [{ name: 'core', dir: 'packages/core', localWorkspaceDependencies: [] }],
    changedFiles: ['packages/core/package.json', 'packages/core/CHANGELOG.md'],
    isReleaseWorthy: isReleaseWorthyWorkspaceFile,
    project: async () => projection,
    readBase,
    readHead: async file => after.get(file),
  })).toEqual(new Set(['core']))
  await expect(projectNativeRelease({ files: ['.changeset/pre.json'], readBase })).rejects.toThrow('Migrate legacy')
  before.delete('.changeset/change.md')
  expect((await projectNativeRelease({ files: [...before.keys()], readBase, branch: 'main' })).versions).toEqual([])
}, 30_000)
