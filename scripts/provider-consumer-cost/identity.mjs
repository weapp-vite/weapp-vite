import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** 两种摘要来自同一次归档读取，安装后只对比冻结值，不重新接受被重打的归档。 */
export function archiveFingerprint(content) {
  return {
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(content).digest('base64')}`,
  }
}

export function assertCandidateIntegrity(name, version, frozen, lock) {
  const records = Object.entries(lock.packages ?? {}).filter(([key]) => key.startsWith(`${name}@`))
  assert(typeof frozen.integrity === 'string' && records.length > 0 && records.every(([, value]) => value.resolution?.integrity === frozen.integrity), `Candidate archive integrity mismatch: ${name}`)
  assert.equal(version, frozen.version, `Installed candidate version mismatch: ${name}`)
}

/** 输入身份包含源码与安装合同，依赖清单或 overrides 漂移都必须重新准备。 */
export function snapshotConsumerInputs(files) {
  const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right))
  return { inputFiles: entries.map(([name]) => name), inputSha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex') }
}

export async function assertConsumerInputs(root, expected) {
  assert(['package.json', 'pnpm-workspace.yaml'].every(file => expected.inputFiles.includes(file)), 'Consumer input identity must include installation contracts')
  const files = Object.fromEntries(await Promise.all(expected.inputFiles.map(async file => [file, await readFile(path.join(root, file), 'utf8')])))
  assert.equal(snapshotConsumerInputs(files).inputSha256, expected.inputSha256, 'Consumer input changed after preparation')
}
