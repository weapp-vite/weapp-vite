import type { GenerationEvidence } from '../generate/types'
import type { CorpusDocument, CorpusFileIdentity, CorpusMetadata } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mitFixtureLicense } from '../collect/licenseFixtures'
import { corpusHash, corpusJson } from '../integrity'
import { corpusPolicy, corpusProfiles } from '../profiles'
import { freezeNativeEvidence } from './native'

export const sourceIdentity = { repository: 'example/templates', commit: 'a'.repeat(40), licenseId: 'example-mit' }
export const generationInputText = '<template><view a="1">😀</view></template>'
export const sourceTree = [
  { path: 'LICENSE', type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(mitFixtureLicense)}\0`).update(mitFixtureLicense).digest('hex') },
  { path: 'original/Page.vue', type: 'blob' as const, sha: createHash('sha1').update(`blob ${Buffer.byteLength(generationInputText)}\0`).update(generationInputText).digest('hex') },
]

export function nativeMetadata(): { metadata: CorpusMetadata, resources: ReturnType<typeof freezeNativeEvidence>['resources'] } {
  const native = freezeNativeEvidence({
    repositories: [{ ...sourceIdentity, independentRepository: sourceIdentity.repository, treeSha256: corpusHash(corpusJson(sourceTree)), treeFiles: sourceTree.length, selectedFiles: 0, excludedFiles: 0, complete: true }],
    sources: [{ ...sourceIdentity, tree: sourceTree, configuration: { ...sourceIdentity, selections: [], inputProjections: [{ files: [{ sourcePath: 'original/Page.vue', destination: 'Page.vue', gitSha: sourceTree[1]!.sha, sha256: corpusHash(generationInputText), bytes: Buffer.byteLength(generationInputText) }] }] } }],
    discovery: [],
  })
  return {
    metadata: {
      id: 'imports-test',
      profiles: corpusProfiles,
      policy: corpusPolicy,
      repositories: native.repositories,
      generations: [],
      discovery: [],
      licenses: [{ id: sourceIdentity.licenseId, repository: sourceIdentity.repository, commit: sourceIdentity.commit, spdx: 'MIT', files: [{ path: 'LICENSE', text: mitFixtureLicense, sha256: corpusHash(mitFixtureLicense) }] }],
    },
    resources: native.resources,
  }
}

/** 受控测试工程只写声明文件，不安装包或执行构建命令。 */
export async function generationProject(directory: string) {
  const source = '<view a="1">😀</view>'
  const bodies: Record<string, string> = {
    'src/Page.vue': generationInputText,
    'package.json': '{"private":true}',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'out/production/page.axml': source,
    'out/production/runtime.js': 'export const compiled = true\n',
    'evidence/attempt-1/production.log': 'done\n',
  }
  const identity = (file: string, physical = file): CorpusFileIdentity => ({ file, sha256: corpusHash(bodies[physical]!), bytes: new TextEncoder().encode(bodies[physical]!).length })
  const report: GenerationEvidence = {
    schemaVersion: 1,
    id: 'mpx-2.11.2-ali-test-production',
    framework: 'mpx',
    version: '2.11.2',
    target: 'ali',
    mode: 'production',
    status: 'built',
    source: sourceIdentity,
    inputDependencies: {},
    runtime: { node: 'v22.18.0', packageManager: 'pnpm@10.0.0' },
    input: [identity('Page.vue', 'src/Page.vue')],
    configuration: [identity('package.json')],
    dependencies: [identity('pnpm-lock.yaml')],
    outputs: [identity('out/production/page.axml'), identity('out/production/runtime.js')],
    logs: [identity('evidence/attempt-1/production.log')],
    commands: [['pnpm', 'install', '--ignore-scripts'], ['pnpm', 'exec', 'webpack']],
  }
  bodies['evidence/production.json'] = `${corpusJson(report)}\n`
  const generation = { id: report.id, framework: report.framework, version: report.version, target: report.target, mode: report.mode, status: report.status, evidence: [identity('evidence/production.json')] }
  const document: CorpusDocument = { source, sha256: corpusHash(source), origins: [{ ...sourceIdentity, path: 'out/production/page.axml', platform: 'alipay', profileId: 'alipay-xml', category: 'generated', generationId: report.id, expectation: 'valid' }] }
  bodies['generations.json'] = `${corpusJson([generation])}\n`
  bodies['documents.jsonl'] = `${corpusJson(document)}\n`
  for (const [file, body] of Object.entries(bodies)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
    await writeFile(path.join(directory, file), body)
  }
  return { bodies, report, generation, document }
}
