import type { NativeEvidenceSource } from './imports'
import type { CorpusCollectionResult, CorpusDiscoveryPage, CorpusMetadata, CorpusSource } from './types'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { corpusHash, corpusJson, mergeCorpusDocuments, readCorpusArchive, writeCorpusArchive } from './archive'
import { collectSources } from './collect'
import { createGitHubClient, readCompleteTree } from './collect/github'
import { discoverRepositories } from './discover'
import { writeCorpusEvidence } from './evidence'
import { generateMain } from './generate'
import { freezeNativeEvidence, importAdditionalEvidence, importExpectedSnapshots, importGenerations, mergeFrozenResources } from './imports'
import { CorpusEvidenceStore, parseEvidenceJson, readOwnedFile } from './imports/files'
import { mergeCorpusLicenses, mergeCorpusRepositories, mergeNativeEvidenceSources } from './imports/merge'
import { matrixClassificationLabel, parseMatrixClassifications } from './matrixClassifications'
import { defaultCorpusCache, defaultCorpusDirectory, defaultCorpusReports } from './paths'
import { corpusPolicy, corpusProfiles } from './profiles'
import { corpusReportMarkdown, inventoryCorpus } from './report'
import { auditFrameworkMatrix, frameworkMatrixMarkdown } from './report/framework'

async function readJson<T>(file: string): Promise<T> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'))
  assert.ok(value && typeof value === 'object', `Invalid JSON input: ${path.basename(file)}`)
  return value as T
}

/** 兼容发现入口的完整报告和独立分页清单，拒绝未经验证的强制类型断言。 */
export function parseDiscoveryInput(value: unknown): CorpusDiscoveryPage[] {
  const pages = value && typeof value === 'object' && !Array.isArray(value) && 'discovery' in value ? value.discovery : value
  assert.ok(Array.isArray(pages), 'Discovery input must be a page array or a discovery report')
  for (const page of pages as CorpusDiscoveryPage[]) {
    assert.ok(page && typeof page === 'object' && typeof page.query === 'string' && page.query.trim(), 'Invalid discovery query')
    assert.ok(Number.isSafeInteger(page.page) && page.page >= 1 && Number.isSafeInteger(page.totalCount) && page.totalCount >= 0, 'Invalid discovery pagination')
    assert.ok(typeof page.incompleteResults === 'boolean' && Array.isArray(page.repositories) && page.repositories.every(repository => typeof repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repository) && repository.split('/').every(part => part !== '.' && part !== '..')), 'Invalid discovery page result')
  }
  return pages as CorpusDiscoveryPage[]
}

/** 显式维护入口负责联网；check 和测试只读取已冻结本地语料。 */
export async function corpusMain(args = process.argv.slice(2)): Promise<void> {
  const [command, ...rest] = args
  if (command === 'generate') {
    await generateMain(rest)
    return
  }
  const { values } = parseArgs({ args: rest, options: {
    'sources': { type: 'string' },
    'queries': { type: 'string' },
    'discovery': { type: 'string' },
    'cache': { type: 'string', default: defaultCorpusCache },
    'output': { type: 'string', default: defaultCorpusDirectory },
    'reports': { type: 'string', default: defaultCorpusReports },
    'generation': { type: 'string', multiple: true },
    'expected': { type: 'string', multiple: true },
    'evidence': { type: 'string', multiple: true },
    'collection': { type: 'string', multiple: true },
    'source-evidence': { type: 'string', multiple: true },
    'matrix-classifications': { type: 'string' },
    'id': { type: 'string', default: 'all-platform-v1' },
  } })
  const output = path.resolve(values.output)
  if (command === 'discover') {
    assert.ok(values.queries, 'discover requires --queries with an explicit query/page budget')
    const queries = await readJson<Array<{ query: string, pages: number }>>(values.queries)
    const result = await discoverRepositories(queries, values.cache)
    await mkdir(values.reports, { recursive: true })
    await writeFile(path.join(values.reports, 'discovery.json'), `${corpusJson(result)}\n`)
    process.stdout.write(`${corpusJson({ candidates: result.repositories.length, pages: result.discovery.length })}\n`)
    return
  }
  if (command === 'collect') {
    assert.ok(values.sources || values.collection?.length, 'collect requires --sources or frozen --collection results')
    const collections: CorpusCollectionResult[] = []
    const sources: NativeEvidenceSource[] = []
    if (values.sources) {
      const configurations = await readJson<CorpusSource[]>(values.sources)
      const client = createGitHubClient({ cacheDir: values.cache })
      collections.push(await collectSources(configurations, {
        cacheDir: values.cache,
        client,
        onProgress: (repository, files) => { process.stdout.write(`${corpusJson({ repository, files })}\n`) },
      }))
      for (const source of configurations) {
        const tree = await readCompleteTree(client, source.repository, source.commit)
        const containerPaths = new Set(collections.flatMap(collection => collection.documents).flatMap(document => document.origins.filter(origin => origin.repository === source.repository && origin.commit === source.commit && /\.ux$/i.test(origin.path)).map(origin => origin.path)))
        const containers = []
        for (const file of tree.filter(file => containerPaths.has(file.path))) {
          const bytes = await client.blob(source.repository, source.commit, file)
          containers.push({ path: file.path, sha256: corpusHash(bytes), text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) })
        }
        sources.push({ repository: source.repository, commit: source.commit, configuration: source, tree, containers })
      }
    }
    for (const file of values.collection ?? []) {
      collections.push(await readJson<CorpusCollectionResult>(file))
    }
    for (const file of values['source-evidence'] ?? []) {
      const imported = await readJson<NativeEvidenceSource[]>(file)
      assert.ok(Array.isArray(imported), 'Source evidence must contain frozen tree/configuration records')
      sources.push(...imported)
    }
    const mergedSources = mergeNativeEvidenceSources(sources)
    const sourceIndex = new Map(mergedSources.map(source => [`${source.repository}@${source.commit}`, source]))
    const expected = await importExpectedSnapshots(values.expected ?? [])
    for (const imported of expected.sources) {
      const source = sourceIndex.get(`${imported.repository}@${imported.commit}`)
      assert.ok(source, 'Static snapshots require frozen upstream tree/configuration mapping')
      const snapshots = new Map((source.snapshots ?? []).map(snapshot => [`${snapshot.path}:${snapshot.format}:${corpusJson(snapshot.files ?? null)}`, snapshot]))
      for (const snapshot of imported.snapshots) {
        const key = `${snapshot.path}:${snapshot.format}:${corpusJson(snapshot.files ?? null)}`
        const previous = snapshots.get(key)
        assert.ok(!previous || (previous.sha256 === snapshot.sha256 && previous.text === snapshot.text), 'Conflicting frozen upstream snapshot content')
        snapshots.set(key, snapshot)
      }
      source.snapshots = [...snapshots.values()]
    }
    const generated = await importGenerations(values.generation ?? [])
    const additional = await importAdditionalEvidence(values.evidence ?? [])
    let matrixClassifications: CorpusMetadata['matrixClassifications']
    if (values['matrix-classifications']) {
      const input = path.resolve(values['matrix-classifications'])
      const bytes = await readOwnedFile(path.dirname(input), path.basename(input))
      parseMatrixClassifications(parseEvidenceJson(bytes))
      const store = new CorpusEvidenceStore()
      matrixClassifications = store.object(bytes)
      const previous = additional.resources.find(resource => resource.file === 'additional/references.json')
      const index = previous ? parseEvidenceJson(typeof previous.content === 'string' ? new TextEncoder().encode(previous.content) : previous.content) as { files: Array<{ file: string, kind: string, object: NonNullable<CorpusMetadata['matrixClassifications']> }> } : { files: [] }
      const entry = { file: matrixClassificationLabel, kind: 'report', object: matrixClassifications }
      const existing = index.files.find(file => file.file === matrixClassificationLabel)
      assert.ok(!existing || corpusJson(existing) === corpusJson(entry), 'Matrix classifications conflict with frozen additional evidence')
      const files = [...index.files.filter(file => file.file !== matrixClassificationLabel), entry].sort((a, b) => a.file.localeCompare(b.file, 'en'))
      additional.evidence = [store.json('additional/references.json', 'report', { schemaVersion: 1, kind: 'additional', files })]
      additional.resources = mergeFrozenResources([...additional.resources.filter(resource => resource.file !== 'additional/references.json'), ...store.resources()])
    }
    const documents = mergeCorpusDocuments([...collections.flatMap(collection => collection.documents), ...expected.documents, ...generated.documents])
    const discovery = values.discovery ? parseDiscoveryInput(await readJson<unknown>(values.discovery)) : []
    const native = freezeNativeEvidence({
      repositories: mergeCorpusRepositories(collections.flatMap(collection => collection.repositories)),
      sources: mergeNativeEvidenceSources(mergedSources),
      discovery,
    })
    const metadata: CorpusMetadata = {
      id: values.id,
      profiles: corpusProfiles,
      policy: corpusPolicy,
      licenses: mergeCorpusLicenses(collections.flatMap(collection => collection.licenses)),
      repositories: native.repositories,
      generations: generated.generations,
      discovery,
      additionalEvidence: additional.evidence,
      matrixClassifications,
      evidence: await writeCorpusEvidence(output, mergeFrozenResources([...native.resources, ...generated.resources, ...additional.resources])),
    }
    await writeCorpusArchive(output, documents, metadata)
    await mkdir(values.reports, { recursive: true })
    await writeFile(path.join(values.reports, 'collection.json'), `${corpusJson({ documents: mergeCorpusDocuments([...collections.flatMap(collection => collection.documents), ...expected.documents]), licenses: metadata.licenses, repositories: metadata.repositories, excluded: collections.flatMap(collection => collection.excluded) })}\n`)
    await writeFile(path.join(values.reports, 'excluded.json'), `${corpusJson(collections.flatMap(collection => collection.excluded))}\n`)
  }
  else {
    assert.equal(command, 'check', 'Commands: discover, collect, generate, check')
  }
  const { manifest, documents } = await readCorpusArchive(output)
  const report = inventoryCorpus(documents, manifest)
  const frameworkMatrix = await auditFrameworkMatrix(manifest.generations)
  report.gaps.push(...frameworkMatrix.gaps)
  report.accepted &&= frameworkMatrix.accepted
  await mkdir(values.reports, { recursive: true })
  await writeFile(path.join(values.reports, 'inventory.json'), `${corpusJson({ corpusId: manifest.id, contentSha256: manifest.contentSha256, ...report, frameworkMatrix })}\n`)
  await writeFile(path.join(values.reports, 'inventory.md'), corpusReportMarkdown(manifest, report) + frameworkMatrixMarkdown(frameworkMatrix))
  process.stdout.write(`${corpusJson(report)}\n`)
  if (command === 'check' && !report.accepted) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await corpusMain()
}
