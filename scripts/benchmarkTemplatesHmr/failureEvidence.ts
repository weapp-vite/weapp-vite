import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sanitizeBenchmarkDevLog } from './diagnostics'

interface ContentEvidence {
  bytes: number
  sha256: string
  containsMarker: boolean
}

/** 在恢复源码之前保存当次输入和可达产物；脱敏文本仅用于诊断，哈希对应原始读取内容。 */
export async function captureBenchmarkFailureEvidence(options: {
  readSource: () => Promise<string>
  readOutput: () => Promise<string>
  marker: string
  repoRoot: string
  artifactFile: string
}) {
  const capturedAt = new Date().toISOString()
  const result: {
    source?: ContentEvidence
    sourceError?: string
    output?: ContentEvidence
    outputError?: string
    artifactError?: string
  } = {}
  const contents: Partial<Record<'source' | 'output', string>> = {}
  const observations = await Promise.allSettled([options.readSource(), options.readOutput()])
  for (const [index, key] of (['source', 'output'] as const).entries()) {
    const observation = observations[index]!
    if (observation.status === 'rejected') {
      const message = observation.reason instanceof Error ? observation.reason.message : String(observation.reason)
      result[`${key}Error`] = sanitizeBenchmarkDevLog(message, options.repoRoot)
      continue
    }
    const content = observation.value
    result[key] = {
      bytes: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex'),
      containsMarker: content.includes(options.marker),
    }
    // 内联 sourcemap 的编码内容可能携带机器路径，不能只脱敏其外层字符串。
    const withoutSourceMaps = content.replace(/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL=[^\r\n]*/g, '<source-map-omitted>')
    contents[key] = sanitizeBenchmarkDevLog(withoutSourceMaps, options.repoRoot)
  }
  try {
    await mkdir(path.dirname(options.artifactFile), { recursive: true })
    await writeFile(options.artifactFile, `${JSON.stringify({ capturedAt, ...result, contents }, null, 2)}\n`, 'utf8')
  }
  catch (error) {
    result.artifactError = sanitizeBenchmarkDevLog(error instanceof Error ? error.message : String(error), options.repoRoot)
  }
  return result
}
