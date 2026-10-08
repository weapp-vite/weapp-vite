import type { SemanticWorkerRequest } from './types'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { executeSemanticModule } from './execute'
import { createSemanticScenario } from './scenarios/index'

function readRequest(value: unknown): SemanticWorkerRequest {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Semantic worker request must be an object')
  }
  const request = value as Partial<SemanticWorkerRequest>
  if (request.schemaVersion !== 1 || typeof request.scenarioId !== 'string'
    || typeof request.filename !== 'string' || typeof request.code !== 'string'
    || (request.timeoutMs !== undefined && (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1))) {
    throw new TypeError('Invalid semantic worker request')
  }
  return request as SemanticWorkerRequest
}

const [requestFile, resultFile, ...extra] = process.argv.slice(2)
if (!requestFile || !resultFile || extra.length > 0) {
  throw new Error('Usage: semantic/worker.ts <request.json> <result.json>')
}
const request = readRequest(JSON.parse(await readFile(requestFile, 'utf8')))
const result = await executeSemanticModule(request, createSemanticScenario)
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
process.exitCode = result.passed ? 0 : 1
