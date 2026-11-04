import type { CorpusFileIdentity, CorpusManifest } from '../types'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { corpusHash, corpusJson } from '../integrity'
import { repositoryRoot } from '../paths'
import { productionFiles } from './index'

interface IdentityGroup {
  sha256: string
  files: CorpusFileIdentity[]
}

export interface CoverageRunIdentity {
  schemaVersion: 1
  frozen: { id: string, contentSha256: string, manifest: CorpusFileIdentity }
  production: IdentityGroup
  built: CorpusFileIdentity
  tests: IdentityGroup
  configuration: IdentityGroup
  lock: CorpusFileIdentity
}

/** 收据只持有仓库相对身份，不把当前工作目录或覆盖率原文中的机器路径写入索引。 */
export async function coverageFileIdentity(file: string, root = repositoryRoot): Promise<CorpusFileIdentity> {
  const label = path.relative(root, path.resolve(root, file)).split(path.sep).join('/')
  assert.ok(label && !label.startsWith('../') && !path.isAbsolute(label), 'Coverage evidence must stay within the repository')
  const bytes = await readFile(path.join(root, label))
  return { file: label, sha256: corpusHash(bytes), bytes: bytes.length }
}

async function listedFiles(directory: string, root: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Coverage identity cannot follow symbolic links')
    const file = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      result.push(...await listedFiles(file, root))
    }
    else if (entry.isFile() && /\.(?:[cm]?ts|[cm]?js|json)$/.test(entry.name)) {
      result.push(file)
    }
  }
  return result.sort()
}

async function group(files: readonly string[], root: string): Promise<IdentityGroup> {
  const identities = await Promise.all([...new Set(files)].sort().map(file => coverageFileIdentity(file, root)))
  return { sha256: corpusHash(corpusJson(identities)), files: identities }
}

/** 分母沿用 productionFiles；测试、配置、构建入口和依赖锁另行绑定，不混入分母。 */
export async function captureCoverageIdentity(root = repositoryRoot): Promise<CoverageRunIdentity> {
  const manifestFile = 'packages/wxml/test/corpus/manifest.json'
  const raw = await readFile(path.join(root, manifestFile), 'utf8')
  const manifest = JSON.parse(raw) as CorpusManifest
  assert.ok(manifest.schemaVersion === 1 && typeof manifest.id === 'string' && /^[\da-f]{64}$/.test(manifest.contentSha256), 'Invalid coverage corpus identity')
  const production = (await productionFiles(path.join(root, 'packages/wxml/src'))).map(file => path.relative(root, file).split(path.sep).join('/'))
  const productionSet = new Set(production)
  const tests = [...await listedFiles('packages/wxml/src', root), ...await listedFiles('scripts/templateCorpus', root)].filter(file => !productionSet.has(file))
  return {
    schemaVersion: 1,
    frozen: { id: manifest.id, contentSha256: manifest.contentSha256, manifest: await coverageFileIdentity(manifestFile, root) },
    production: await group(production, root),
    built: await coverageFileIdentity('packages/wxml/dist/index.mjs', root),
    tests: await group(tests, root),
    configuration: await group(['packages/wxml/vitest.coverage.config.ts', 'packages/wxml/tsconfig.json', 'packages/wxml/tsdown.config.ts', 'packages/wxml/package.json', 'package.json'], root),
    lock: await coverageFileIdentity('pnpm-lock.yaml', root),
  }
}

/** 执行结束重新读取全部身份，禁止将运行期间发生变化的源码或清单验收为通过。 */
export async function assertCoverageIdentity(expected: CoverageRunIdentity, root = repositoryRoot): Promise<void> {
  assert.equal(corpusJson(await captureCoverageIdentity(root)), corpusJson(expected), 'Coverage manifest, source, built entry, tests, configuration or lock changed during execution')
}

export interface SourceCoverageEvidence {
  runId: string
  identity: CoverageRunIdentity
  accepted: boolean
}

/** 独立运行的旧报告不能成为本轮正式覆盖率的输入证据。 */
export function assertSourceCoverageEvidence(value: unknown, runId: string, identity: CoverageRunIdentity): asserts value is SourceCoverageEvidence {
  assert.ok(value && typeof value === 'object' && 'runId' in value && value.runId === runId, 'Source coverage report belongs to another execution')
  assert.ok('identity' in value && corpusJson(value.identity) === corpusJson(identity), 'Source coverage report identity differs from this execution')
  assert.ok('accepted' in value && value.accepted === true, 'Source coverage acceptance did not pass')
}
