import type { CorpusDocument } from '../types'
import type { FrameworkTarget, GenerationEvidence } from './types'
import assert from 'node:assert/strict'
import path from 'node:path'
import { corpusHash } from '../archive'
import { findContainerTemplate } from '../collect/container'
import { listOutputFiles, readOutputFile } from './files'

export { extractContainerTemplate, findContainerTemplate } from '../collect/container'

export async function collectGeneratedDocuments(project: string, output: string, target: FrameworkTarget, evidence: GenerationEvidence): Promise<CorpusDocument[]> {
  assert.equal(output, `out/${evidence.mode}`, 'Generation output must stay within its mode root')
  const documents: CorpusDocument[] = []
  const nonTemplateOutputs: NonNullable<GenerationEvidence['nonTemplateOutputs']> = []
  for (const file of await listOutputFiles(project, evidence.mode)) {
    if (!target.extensions.includes(path.extname(file))) {
      continue
    }
    const bytes = await readOutputFile(project, file, evidence.mode)
    const original = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    const extracted = target.container ? findContainerTemplate(original) : undefined
    if (target.container && !extracted) {
      nonTemplateOutputs.push({ original: { file, sha256: corpusHash(bytes), bytes: bytes.length }, reason: 'no-explicit-template' })
      continue
    }
    const source = extracted?.source ?? original
    documents.push({
      source,
      sha256: corpusHash(source),
      origins: [{
        ...evidence.source,
        path: file,
        platform: target.platform,
        profileId: target.profileId,
        category: 'generated',
        generationId: evidence.id,
        expectation: 'valid',
        evidence: [target.evidence, ...(extracted ? [`container-template-utf16:${extracted.start}:${extracted.end}`] : [])],
      }],
    })
  }
  if (evidence.nonTemplateOutputs !== undefined) {
    assert.deepEqual(evidence.nonTemplateOutputs, nonTemplateOutputs, 'Frozen non-template output exclusions changed')
  }
  else {
    evidence.nonTemplateOutputs = nonTemplateOutputs
  }
  assert.ok(documents.length, 'Compiler emitted no registered markup templates; cell remains incomplete')
  return documents
}
