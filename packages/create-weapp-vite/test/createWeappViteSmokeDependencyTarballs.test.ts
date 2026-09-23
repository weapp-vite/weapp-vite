import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { applyDependencyTarballs, describeDependencyTarballs, resolveDependencyTarballs, validateDependencyTarballScenarios } from '../../../scripts/createWeappViteSmoke/dependencyTarballs.mjs'
import { mergeSmokeReports, renderSmokeReport } from '../../../scripts/merge-create-weapp-vite-smoke-reports.mjs'

const roots: string[] = []

async function createRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-dependency-tarballs-'))
  roots.push(root)
  return root
}

async function createArtifacts(root: string) {
  const files = {
    'weapp-vite': path.join(root, 'weapp-vite-7.2.0.tgz'),
    '@weapp-core/compiler': path.join(root, 'weapp-core-compiler-7.2.0.tgz'),
  }
  await Promise.all(Object.values(files).map(file => fs.writeFile(file, 'fixture')))
  return resolveDependencyTarballs(JSON.stringify(files))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('smoke local dependency candidates', () => {
  it.each([undefined, '', '  ', '{}'])('keeps ordinary registry behavior without configured candidates: %s', async (value) => {
    const artifacts = await resolveDependencyTarballs(value)
    expect(artifacts).toEqual([])
    expect(describeDependencyTarballs(artifacts)).toEqual({ dependencySource: 'registry', dependencyArtifacts: [] })
    expect(() => validateDependencyTarballScenarios(artifacts, [{ name: 'npm' }, { name: 'yarn' }])).not.toThrow()
  })

  it('loads ordinary registry smoke without repository dependencies', async () => {
    const root = await createRoot()
    await fs.copyFile(new URL('../../../scripts/createWeappViteSmoke/dependencyTarballs.mjs', import.meta.url), path.join(root, 'dependencyTarballs.mjs'))
    const script = `
      import { applyDependencyTarballs, resolveDependencyTarballs } from './dependencyTarballs.mjs'
      for (const value of [undefined, '', '{}']) {
        await applyDependencyTarballs('.', await resolveDependencyTarballs(value))
      }
    `
    await expect(promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script], { cwd: root })).resolves.toMatchObject({ stderr: '' })
    expect(await fs.readdir(root)).toEqual(['dependencyTarballs.mjs'])
  })

  it.each(['invalid-json', 'null', '[]', '1', '{"Bad/Name":"invalid.tgz"}', '{"../private":"invalid.tgz"}', '{"weapp-vite":"relative.tgz"}', '{"weapp-vite":null}'])('rejects invalid configuration: %s', async (value) => {
    await expect(resolveDependencyTarballs(value)).rejects.toThrow('CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS')
  })

  it('rejects missing files, directories and other extensions without exposing local paths', async () => {
    const root = await createRoot()
    const directory = path.join(root, 'directory.tgz')
    const wrongExtension = path.join(root, 'package.tar')
    await fs.mkdir(directory)
    await fs.writeFile(wrongExtension, '')
    for (const tarball of [path.join(root, 'missing.tgz'), directory, wrongExtension]) {
      const error = await resolveDependencyTarballs(JSON.stringify({ 'weapp-vite': tarball })).catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(Error)
      expect(String(error)).toContain('weapp-vite')
      expect(String(error)).not.toContain(root)
    }
  })

  it('allows only pnpm when candidate overrides are configured', async () => {
    const artifacts = await createArtifacts(await createRoot())
    expect(() => validateDependencyTarballScenarios(artifacts, [{ name: 'pnpm' }])).not.toThrow()
    expect(() => validateDependencyTarballScenarios(artifacts, [{ name: 'pnpm' }, { name: 'npm' }])).toThrow('CREATE_WEAPP_VITE_SCENARIOS=pnpm')
  })

  it('preserves workspace settings and applies package-wide overrides without changing direct dependencies', async () => {
    const root = await createRoot()
    const artifacts = await createArtifacts(root)
    const workspace = path.join(root, 'pnpm-workspace.yaml')
    const packageJson = '{"dependencies":{"weapp-vite":"7.2.0"},"devDependencies":{"@weapp-core/compiler":"^7.0.0"}}\n'
    await fs.writeFile(path.join(root, 'package.json'), packageJson)
    await fs.writeFile(workspace, '# preserve workspace policy\npackages: []\nallowBuilds:\n  rolldown: true\noverrides:\n  unrelated: 1.0.0\n  weapp-vite: 7.1.0\n')
    await applyDependencyTarballs(root, artifacts)
    const source = await fs.readFile(workspace, 'utf8')
    const config = parse(source) as { packages: string[], allowBuilds: Record<string, boolean>, overrides: Record<string, string> }
    expect(source).toContain('# preserve workspace policy')
    expect(config.packages).toEqual([])
    expect(config.allowBuilds).toEqual({ rolldown: true })
    expect(config.overrides).toEqual({
      unrelated: '1.0.0',
      ...Object.fromEntries(artifacts.map(({ name, tarball }) => [name, `file:${tarball.replaceAll('\\', '/')}`])),
    })
    // 无版本限定的官方 overrides 同时匹配直接依赖与传递依赖中的精确版本。
    expect(Object.keys(config.overrides)).toEqual(['unrelated', 'weapp-vite', '@weapp-core/compiler'])
    expect(await fs.readFile(path.join(root, 'package.json'), 'utf8')).toBe(packageJson)
  })

  it('creates standalone workspace configuration when absent', async () => {
    const root = await createRoot()
    const artifacts = await createArtifacts(root)
    await applyDependencyTarballs(root, artifacts)
    const config = parse(await fs.readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[], overrides: Record<string, string> }
    expect(config.packages).toEqual([])
    expect(Object.keys(config.overrides)).toEqual(['weapp-vite', '@weapp-core/compiler'])
  })

  it.each(['packages: [invalid\n', '- list-root\n', 'packages: []\noverrides: []\n'])('rejects invalid workspace configuration without mutation: %s', async (source) => {
    const root = await createRoot()
    const artifacts = await createArtifacts(root)
    const workspace = path.join(root, 'pnpm-workspace.yaml')
    await fs.writeFile(workspace, source)
    await applyDependencyTarballs(root, [])
    expect(await fs.readFile(workspace, 'utf8')).toBe(source)
    await expect(applyDependencyTarballs(root, artifacts)).rejects.toThrow('Local dependency candidates require')
    expect(await fs.readFile(workspace, 'utf8')).toBe(source)
  })

  it('identifies local candidates in every merged report section without absolute paths', async () => {
    const root = await createRoot()
    const metadata = describeDependencyTarballs(await createArtifacts(root))
    expect(metadata).toEqual({
      dependencySource: 'local-tarballs',
      dependencyArtifacts: [
        { name: 'weapp-vite', filename: 'weapp-vite-7.2.0.tgz' },
        { name: '@weapp-core/compiler', filename: 'weapp-core-compiler-7.2.0.tgz' },
      ],
    })
    const report = { os: 'linux', nodeVersion: '24', ...metadata, results: [{}], failures: [{ kind: 'product' }], registries: [{}], summary: { status: 'product-failure' } }
    const merged = mergeSmokeReports([report])
    for (const rows of [merged.rows, merged.failures, merged.registries, merged.summaries]) {
      expect(rows[0]).toMatchObject(metadata)
    }
    const markdown = renderSmokeReport(merged)
    expect(markdown.match(/local tarballs:/g)).toHaveLength(4)
    expect(markdown).toContain('weapp-vite (weapp-vite-7.2.0.tgz)')
    expect(markdown).toContain('@weapp-core/compiler (weapp-core-compiler-7.2.0.tgz)')
    expect(`${JSON.stringify(merged)}${markdown}`).not.toContain(root)

    const legacy = mergeSmokeReports([{ results: [{}], summary: { status: 'passed' } }])
    expect(legacy.rows[0]).toMatchObject({ dependencySource: 'registry', dependencyArtifacts: [] })
    expect(renderSmokeReport(legacy)).toContain('Dependencies registry: passed')
  })
})
