import type { GenerationReferenceIndex } from './types'
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { readCorpusArchive, writeCorpusArchive } from '../archive'
import { extractContainerTemplate } from '../collect/container'
import { writeCorpusEvidence } from '../evidence'
import { corpusHash, corpusJson } from '../integrity'
import { mergeFrozenResources } from './files'
import { importGenerations } from './generations'
import { generationProject, nativeMetadata } from './testFixtures'
import { validateFrozenReferences } from './verify'

const temporary: string[] = []

async function directory() {
  const result = await mkdtemp(path.join(os.tmpdir(), 'corpus-import-'))
  temporary.push(result)
  return result
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('freezes original build inputs, configuration, lock, non-template outputs and logs for offline archive verification', async () => {
  const project = await directory()
  const output = await directory()
  const fixture = await generationProject(project)
  const generated = await importGenerations([project])
  const native = nativeMetadata()
  const resources = mergeFrozenResources([...native.resources, ...generated.resources])
  const metadata = { ...native.metadata, generations: generated.generations, evidence: await writeCorpusEvidence(output, resources) }
  const referenceIdentity = generated.generations[0]!.evidence[0]!
  expect(referenceIdentity.file).toBe(`generations/${fixture.report.id}/references.json`)
  const reference = JSON.parse(new TextDecoder().decode(generated.resources.find(resource => resource.file === referenceIdentity.file)!.content as Uint8Array)) as GenerationReferenceIndex
  expect(reference.reports[0]!.files.map(file => file.role).sort()).toEqual(['configuration', 'dependencies', 'input', 'logs', 'outputs'])
  expect(reference.reports[0]!.templates[0]!.documentSha256).toBe(fixture.document.sha256)
  await writeCorpusArchive(output, generated.documents, metadata)
  await rm(project, { recursive: true, force: true })
  expect((await readCorpusArchive(output)).documents).toEqual(generated.documents)
})

it('freezes QuickApp npm containers emitted below the output mode without reading installed dependencies', async () => {
  const project = await directory()
  const output = await directory()
  const fixture = await generationProject(project)
  const file = 'out/production/src/npm/.pnpm/components@1/node_modules/components/button.ux'
  const original = '<template><div a="1">😀</div></template>\n<script>const fake = "<template>fake</template>"</script>'
  const extracted = extractContainerTemplate(original)
  const applicationFile = 'out/production/app.ux'
  const applicationSource = '<script>export default { onCreate() {} }</script>\n<style>div { color: red }</style>'
  await mkdir(path.dirname(path.join(project, file)), { recursive: true })
  await writeFile(path.join(project, file), original)
  fixture.report.id = 'taro-2.2.22-quickapp-test-production'
  fixture.report.framework = 'taro'
  fixture.report.version = '2.2.22'
  fixture.report.target = 'quickapp'
  fixture.report.outputs.push({ file, sha256: corpusHash(original), bytes: new TextEncoder().encode(original).length })
  const application = { file: applicationFile, sha256: corpusHash(applicationSource), bytes: new TextEncoder().encode(applicationSource).length }
  fixture.report.outputs.push(application)
  fixture.report.nonTemplateOutputs = [{ original: application, reason: 'no-explicit-template' }]
  await writeFile(path.join(project, applicationFile), applicationSource)
  const reportBytes = `${corpusJson(fixture.report)}\n`
  await writeFile(path.join(project, 'evidence/production.json'), reportBytes)
  const generation = { ...fixture.generation, id: fixture.report.id, framework: fixture.report.framework, version: fixture.report.version, target: fixture.report.target, evidence: [{ file: 'evidence/production.json', sha256: corpusHash(reportBytes), bytes: new TextEncoder().encode(reportBytes).length }] }
  const document = { source: extracted.source, sha256: corpusHash(extracted.source), origins: [{ ...fixture.document.origins[0]!, path: file, platform: 'quickapp', profileId: 'quickapp-template', generationId: generation.id }] }
  await writeFile(path.join(project, 'generations.json'), `${corpusJson([generation])}\n`)
  await writeFile(path.join(project, 'documents.jsonl'), `${corpusJson(document)}\n`)
  const generated = await importGenerations([project])
  const native = nativeMetadata()
  const resources = mergeFrozenResources([...native.resources, ...generated.resources])
  const metadata = { ...native.metadata, generations: generated.generations, evidence: await writeCorpusEvidence(output, resources) }
  const referenceIdentity = generated.generations[0]!.evidence[0]!
  const reference = JSON.parse(new TextDecoder().decode(generated.resources.find(resource => resource.file === referenceIdentity.file)!.content as Uint8Array)) as GenerationReferenceIndex
  expect(reference.reports[0]!.templates[0]!.container).toMatchObject({ start: extracted.start, end: extracted.end })
  expect(reference.reports[0]!.templates[0]!.original.file).toBe(file)
  expect(reference.reports[0]!.files).toContainEqual(expect.objectContaining({ role: 'outputs', original: application }))
  await writeCorpusArchive(output, generated.documents, metadata)
  await rm(project, { recursive: true, force: true })
  expect((await readCorpusArchive(output)).documents).toEqual([document])
})

it('rejects changed input bytes, omitted output files, unsafe inventories and symbolic links before freezing', async () => {
  const changed = await directory()
  await generationProject(changed)
  await writeFile(path.join(changed, 'src/Page.vue'), 'changed')
  await expect(importGenerations([changed])).rejects.toThrow('Imported evidence size changed')

  const omitted = await directory()
  await generationProject(omitted)
  await writeFile(path.join(omitted, 'out/production/omitted.axml'), '<view/>')
  await expect(importGenerations([omitted])).rejects.toThrow('output inventory omits or adds files')

  const unsafe = await directory()
  const fixture = await generationProject(unsafe)
  fixture.generation.evidence[0]!.file = 'node_modules/hidden/report.json'
  await writeFile(path.join(unsafe, 'generations.json'), corpusJson([fixture.generation]))
  await expect(importGenerations([unsafe])).rejects.toThrow('Unsafe imported file path')

  const linked = await directory()
  await generationProject(linked)
  const original = await readFile(path.join(linked, 'src/Page.vue'))
  await writeFile(path.join(linked, 'external.vue'), original)
  await rm(path.join(linked, 'src/Page.vue'))
  await symlink('../external.vue', path.join(linked, 'src/Page.vue'))
  await expect(importGenerations([linked])).rejects.toThrow('cannot follow symbolic links')
})

it('refuses a declared WXML output silently omitted from the template cases', async () => {
  const project = await directory()
  const fixture = await generationProject(project)
  await rename(path.join(project, 'out/production/page.axml'), path.join(project, 'out/production/page.wxml'))
  fixture.report.target = 'wx'
  fixture.report.outputs[0]!.file = 'out/production/page.wxml'
  const omittedSource = '<view wx:if="{{visible}}">unclassified output</view>'
  const omitted = { file: 'out/production/omitted.wxml', sha256: corpusHash(omittedSource), bytes: new TextEncoder().encode(omittedSource).length }
  fixture.report.outputs.push(omitted)
  await writeFile(path.join(project, omitted.file), omittedSource)
  const reportText = `${corpusJson(fixture.report)}\n`
  await writeFile(path.join(project, 'evidence/production.json'), reportText)
  const generation = { ...fixture.generation, target: 'wx', evidence: [{ file: 'evidence/production.json', sha256: corpusHash(reportText), bytes: new TextEncoder().encode(reportText).length }] }
  const document = { ...fixture.document, origins: [{ ...fixture.document.origins[0]!, path: 'out/production/page.wxml', platform: 'weapp', profileId: 'weapp-legacy' }] }
  await writeFile(path.join(project, 'generations.json'), `${corpusJson([generation])}\n`)
  await writeFile(path.join(project, 'documents.jsonl'), `${corpusJson(document)}\n`)
  await expect(importGenerations([project])).rejects.toThrow('Registered template output inventory is incomplete')
})

it('refuses an offline template demoted to a generic output even when its complete output proof is retained', async () => {
  const project = await directory()
  const fixture = await generationProject(project)
  const generated = await importGenerations([project])
  const native = nativeMetadata()
  const metadata = { ...native.metadata, generations: generated.generations }
  const identity = generated.generations[0]!.evidence[0]!
  const resource = generated.resources.find(resource => resource.file === identity.file)!
  const reference = JSON.parse(new TextDecoder().decode(resource.content as Uint8Array)) as GenerationReferenceIndex
  const template = reference.reports[0]!.templates.pop()!
  const bytes = new TextEncoder().encode(fixture.document.source)
  const object = { file: `objects/${corpusHash(bytes)}`, sha256: corpusHash(bytes), bytes: bytes.length }
  reference.reports[0]!.files.push({ role: 'outputs', original: template.original, object })
  resource.content = new TextEncoder().encode(`${corpusJson(reference)}\n`)
  identity.sha256 = corpusHash(resource.content)
  identity.bytes = resource.content.length
  const resources = mergeFrozenResources([...native.resources, ...generated.resources, { file: object.file, kind: 'input', content: bytes }])
  expect(() => validateFrozenReferences(metadata, generated.documents, resources)).toThrow('Registered template output inventory is incomplete')
})

it('does not accept frozen output declarations without the actual referenced bytes or complete output proofs', async () => {
  const project = await directory()
  await generationProject(project)
  const generated = await importGenerations([project])
  const { metadata } = nativeMetadata()
  const native = nativeMetadata()
  metadata.generations = generated.generations
  const resources = [...native.resources, ...generated.resources]
  const referenceIdentity = generated.generations[0]!.evidence[0]!
  const referenceResource = generated.resources.find(resource => resource.file === referenceIdentity.file)!
  const reference = JSON.parse(new TextDecoder().decode(referenceResource.content as Uint8Array)) as GenerationReferenceIndex
  const output = reference.reports[0]!.files.find(file => file.role === 'outputs')!
  expect(() => validateFrozenReferences(metadata, generated.documents, resources.filter(resource => resource.file !== output.object.file))).toThrow('Missing frozen evidence resource')
  reference.reports[0]!.files = reference.reports[0]!.files.filter(file => file.role !== 'outputs')
  const bytes = new TextEncoder().encode(`${corpusJson(reference)}\n`)
  referenceResource.content = bytes
  referenceIdentity.sha256 = corpusHash(bytes)
  referenceIdentity.bytes = bytes.length
  expect(() => validateFrozenReferences(metadata, generated.documents, resources)).toThrow('output inventory is incomplete')
})

it('preserves original failed attempts and refuses history whose physical configuration has changed', async () => {
  const project = await directory()
  const fixture = await generationProject(project)
  const history = { ...fixture.report, status: 'failed', outputs: [], reason: 'previous build failed' }
  await mkdir(path.join(project, 'evidence/history'))
  await writeFile(path.join(project, 'evidence/history/production-1.json'), `${corpusJson(history)}\n`)
  const generated = await importGenerations([project])
  const resource = generated.resources.find(resource => resource.file.startsWith('generations/'))!
  const reference = JSON.parse(new TextDecoder().decode(resource.content as Uint8Array)) as GenerationReferenceIndex
  expect(reference.reports).toHaveLength(2)
  history.configuration = [{ ...history.configuration[0]!, sha256: 'f'.repeat(64) }]
  await writeFile(path.join(project, 'evidence/history/production-1.json'), `${corpusJson(history)}\n`)
  await expect(importGenerations([project])).rejects.toThrow('Imported evidence hash changed')
})
