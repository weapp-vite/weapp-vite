import assert from 'node:assert/strict'
import { lstat, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** 正式证据只允许首次写入，后续失败或重试不能覆盖原始字节。 */
export async function writeCaptureJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
}

/** 每个输出独占一份永久保留的轮次声明，不代替真实 E2E 机器租约。 */
export async function reserveCaptureOutput(output, companions, identity) {
  assert(!/\.(?:inputs|frozen|capture)\.json$/iu.test(output), 'Capture output cannot use a reserved evidence suffix')
  const reservation = `${output}.capture.json`
  const files = [output, ...companions, reservation]
  assert(new Set(files).size === files.length, 'Capture evidence paths must be distinct')
  for (const file of files) {
    const existing = await lstat(file).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error
      }
    })
    assert(!existing, 'Capture evidence already exists; choose a new output')
  }
  await writeCaptureJson(reservation, {
    schemaVersion: 1,
    kind: 'benchmark-capture-reservation',
    ...identity,
    createdAt: new Date().toISOString(),
    outputs: files.map(file => path.basename(file)),
  })
  return reservation
}
