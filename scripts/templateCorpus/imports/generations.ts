import type { GenerationEvidence } from '../generate/types'
import type { CorpusDocument, CorpusFileIdentity, CorpusGeneration } from '../types'
import type { FrozenGenerationReport, GenerationReferenceIndex } from './types'
import assert from 'node:assert/strict'
import { extractContainerTemplate } from '../collect/container'
import { corpusHash, corpusJson } from '../integrity'
import { assertIdentity, CorpusEvidenceStore, ownedFiles, ownedOutputFiles, parseEvidenceJson, readOwnedFile, readVerifiedFile, readVerifiedOutput } from './files'
import { validateNonTemplateOutputs } from './nonTemplateOutputs'
import { readGenerationReport } from './report'
import { validateGenerationTemplateInventory } from './templateInventory'

interface TemplateCase {
  source: string
  sha256: string
  path: string
  generationId: string
  fixture: boolean
}

function identity(file: string, content: Uint8Array): CorpusFileIdentity {
  return { file, sha256: corpusHash(content), bytes: content.length }
}

function jsonLines(bytes: Uint8Array): unknown[] {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes).split('\n').filter(Boolean).map((line): unknown => JSON.parse(line))
}

async function optionalFile(directory: string, file: string): Promise<Uint8Array | undefined> {
  try {
    return await readOwnedFile(directory, file)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function generatedDocuments(bytes: Uint8Array): CorpusDocument[] {
  return jsonLines(bytes).map((value) => {
    assert.ok(value && typeof value === 'object' && 'source' in value && typeof value.source === 'string' && 'sha256' in value && 'origins' in value && Array.isArray(value.origins), 'Invalid imported generated document')
    const document = value as CorpusDocument
    assert.equal(corpusHash(document.source), document.sha256, 'Imported generated document hash mismatch')
    assert.ok(document.origins.length && document.origins.every(origin => origin.category === 'generated' && typeof origin.generationId === 'string'), 'Generated document has no generation identity')
    return document
  })
}

function templateCases(documents: CorpusDocument[], matrix: unknown[]): TemplateCase[] {
  const result = documents.flatMap(document => document.origins.map(origin => ({ source: document.source, sha256: document.sha256, path: origin.path, generationId: origin.generationId!, fixture: false })))
  for (const candidate of matrix) {
    assert.ok(candidate && typeof candidate === 'object', 'Invalid imported matrix fixture')
    const value = candidate as Record<string, unknown>
    assert.ok(typeof value.source === 'string' && typeof value.path === 'string' && typeof value.generationId === 'string' && value.quotaEligible === false && value.sha256 === corpusHash(value.source), 'Invalid matrix fixture provenance')
    result.push({ source: value.source, sha256: value.sha256 as string, path: value.path, generationId: value.generationId, fixture: true })
  }
  return result
}

async function freezeReport(directory: string, original: CorpusFileIdentity, reportBytes: Uint8Array, report: GenerationEvidence, cases: TemplateCase[], store: CorpusEvidenceStore): Promise<FrozenGenerationReport> {
  const frozen: FrozenGenerationReport = { original, object: store.object(reportBytes), files: [], templates: [] }
  for (const role of ['input', 'configuration', 'dependencies', 'logs'] as const) {
    for (const file of report[role]) {
      const bytes = await readVerifiedFile(directory, file, role === 'input' ? `src/${file.file}` : file.file)
      frozen.files.push({ role, original: file, object: store.object(bytes) })
    }
  }
  if (report.status === 'built') {
    const actual = await ownedOutputFiles(directory, report.mode)
    assert.equal(corpusJson(actual.sort()), corpusJson(report.outputs.map(file => file.file).sort()), 'Generation output inventory omits or adds files')
    assert.equal(corpusJson((await ownedFiles(directory, 'src')).map(file => file.slice(4)).sort()), corpusJson(report.input.map(file => file.file).sort()), 'Generation source inventory omits or adds files')
  }
  const outputs = new Map<string, Uint8Array>()
  for (const file of report.outputs) {
    const bytes = await readVerifiedOutput(directory, file, report.mode)
    outputs.set(file.file, bytes)
    if (!cases.some(candidate => candidate.generationId === report.id && candidate.path === file.file)) {
      frozen.files.push({ role: 'outputs', original: file, object: store.object(bytes) })
    }
  }
  validateNonTemplateOutputs(report, outputs, cases.filter(candidate => candidate.generationId === report.id).map(candidate => candidate.path))
  for (const candidate of cases.filter(candidate => candidate.generationId === report.id)) {
    assert.equal(candidate.fixture, report.provenance?.quotaEligible === false, 'Controlled fixtures cannot become real corpus origins')
    const output = report.outputs.find(file => file.file === candidate.path)
    assert.ok(output, 'Generated template has no declared output identity')
    const bytes = outputs.get(output.file)!
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    const reference: FrozenGenerationReport['templates'][number] = { original: output, documentSha256: candidate.sha256 }
    if (source !== candidate.source) {
      const extracted = extractContainerTemplate(source)
      assert.equal(extracted.source, candidate.source, 'Generated container projection changed')
      reference.container = { start: extracted.start, end: extracted.end, object: store.object(bytes) }
    }
    if (candidate.fixture) {
      reference.fixtureObject = store.object(candidate.source)
    }
    frozen.templates.push(reference)
  }
  if (report.status === 'built') {
    assert.ok(frozen.templates.length, 'Built generation has no verified markup template')
  }
  validateGenerationTemplateInventory(report, frozen.templates)
  return frozen
}

/** 恢复原报告与真实产物后再导入；只读文件，不安装依赖、不运行上游脚本。 */
export async function importGenerations(directories: readonly string[]) {
  const store = new CorpusEvidenceStore()
  const documents: CorpusDocument[] = []
  const generations: CorpusGeneration[] = []
  const seen = new Set<string>()
  for (const directory of directories) {
    const inventoryBytes = await readOwnedFile(directory, 'generations.json')
    const inventory = parseEvidenceJson(inventoryBytes)
    assert.ok(Array.isArray(inventory), 'Invalid generation inventory')
    const documentBytes = await readOwnedFile(directory, 'documents.jsonl')
    const imported = generatedDocuments(documentBytes)
    assert.equal(new TextDecoder().decode(documentBytes), imported.map(corpusJson).join('\n') + (imported.length ? '\n' : ''), 'Generated documents must preserve canonical original JSONL')
    documents.push(...imported)
    const matrixBytes = await optionalFile(directory, 'matrix-templates.jsonl')
    const matrix = matrixBytes ? jsonLines(matrixBytes) : []
    if (matrixBytes) {
      assert.equal(new TextDecoder().decode(matrixBytes), matrix.map(corpusJson).join('\n') + (matrix.length ? '\n' : ''), 'Matrix templates must preserve canonical original JSONL')
    }
    const cases = templateCases(imported, matrix)
    let historyFiles: string[] = []
    try {
      historyFiles = (await ownedFiles(directory, 'evidence/history')).filter(file => file.endsWith('.json'))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    const histories = await Promise.all(historyFiles.map(async (file) => {
      const bytes = await readOwnedFile(directory, file)
      return { bytes, original: identity(file, bytes), report: readGenerationReport(parseEvidenceJson(bytes)) }
    }))
    const ids = new Set(inventory.map((value: CorpusGeneration) => value.id))
    assert.ok(cases.every(candidate => ids.has(candidate.generationId)) && histories.every(history => ids.has(history.report.id)), 'Orphan generated template or history report')
    for (const value of inventory) {
      assert.ok(value && typeof value === 'object', 'Invalid imported generation')
      const generation = value as CorpusGeneration
      assert.ok(!seen.has(generation.id) && Array.isArray(generation.evidence) && generation.evidence.length === 1, 'Duplicate generation or ambiguous primary report')
      seen.add(generation.id)
      const original = generation.evidence[0]!
      assertIdentity(original)
      const bytes = await readVerifiedFile(directory, original)
      const report = readGenerationReport(parseEvidenceJson(bytes))
      for (const field of ['id', 'framework', 'version', 'target', 'mode', 'status'] as const) {
        assert.equal(report[field], generation[field], 'Generation inventory/report identity mismatch')
      }
      const reports = [await freezeReport(directory, original, bytes, report, cases, store)]
      for (const history of histories.filter(history => history.report.id === report.id)) {
        reports.push(await freezeReport(directory, history.original, history.bytes, history.report, history.report.status === 'built' ? cases : [], store))
      }
      const reference: GenerationReferenceIndex = {
        schemaVersion: 1,
        kind: 'generation',
        generationId: generation.id,
        reports,
        inventory: store.object(inventoryBytes),
        documents: { original: identity('documents.jsonl', documentBytes), records: imported.map(({ sha256, origins }) => ({ sha256, origins })) },
      }
      if (matrixBytes) {
        reference.matrixTemplates = {
          original: identity('matrix-templates.jsonl', matrixBytes),
          records: matrix.map((value) => {
            const { source, ...metadata } = value as Record<string, unknown>
            return { metadata, object: store.object(source as string) }
          }),
        }
      }
      const bound = store.json(`generations/${generation.id}/references.json`, 'report', reference)
      generations.push({ ...generation, evidence: [bound] })
    }
  }
  return { documents, generations, resources: store.resources() }
}
