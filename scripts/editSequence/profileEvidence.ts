import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'
import { redactSequenceEvidence, redactSequenceEvidenceText } from './evidenceRedaction'
import { normalizeSequenceModuleId } from './moduleId'

interface SequenceProfileEvidence extends ReturnType<typeof readHmrProfileLines> {
  rawLines: Array<{ line: number, classification: string, text: string }>
}

/** 宿主关闭并排空诊断写入后读取真实事件，保留耗时原值并去除机器路径。 */
export async function readSequenceProfile(root: string): Promise<SequenceProfileEvidence> {
  let content = ''
  try {
    content = await readFile(path.join(root, '.weapp-vite/hmr-profile.jsonl'), 'utf8')
  }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error
    }
  }
  const result = readHmrProfileLines(content)
  const rawLines = content.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) {
      return []
    }
    const { coverage } = readHmrProfileLines(line)
    const classification = Object.entries(coverage).find(([, count]) => count > 0)![0]
    let text: string
    try {
      const value: unknown = JSON.parse(line)
      text = JSON.stringify(redactSequenceEvidence(value, root))
    }
    catch {
      text = redactSequenceEvidenceText(line, root)
    }
    return [{ line: index + 1, classification, text }]
  })
  return {
    ...result,
    rawLines,
    samples: result.samples.map(sample => redactSequenceEvidence({
      ...sample,
      file: sample.file && normalizeSequenceModuleId(sample.file, root),
      sourceEvents: sample.sourceEvents?.map(event => ({ ...event, file: event.file && normalizeSequenceModuleId(event.file, root) })),
    }, root)),
  }
}
