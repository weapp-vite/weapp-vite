import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 复用消费者入口的跨平台启动与失败传播。
import { execa } from 'execa'
import { assertImportsConsumerReceipt } from './identity.mjs'

/** 独立 imports 消费者共用机器租约，完整成功后才登记可聚合的执行证据。 */
export async function runImportsConsumer(host, output, { execute = execa } = {}) {
  assert(['wv', 'vite', 'vite-plus'].includes(host), 'Unsupported imports consumer host')
  const filename = path.resolve(output)
  const originalEvidence = `${filename}.imports.json`
  await mkdir(path.dirname(filename), { recursive: true })
  await rm(filename, { force: true })
  await rm(originalEvidence, { force: true })
  const result = await execute(process.execPath, [
    '--import',
    'tsx',
    'e2e/scripts/run-e2e-commands.ts',
    process.execPath,
    'packages/weapp-vite/scripts/consumerImports/install.mjs',
    host,
    ...(host === 'wv' ? ['headless'] : []),
  ], {
    cwd: new URL('../../', import.meta.url),
    stdio: 'inherit',
    reject: false,
    env: { WEAPP_VITE_IMPORTS_EVIDENCE: originalEvidence },
  })
  assert.equal(result.exitCode, 0, `Imports consumer failed: ${host}`)
  const bytes = await readFile(originalEvidence)
  const imports = JSON.parse(bytes.toString('utf8'))
  assertImportsConsumerReceipt(imports, host)
  const evidence = {
    schemaVersion: 1,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    toolchain: host,
    imports,
    importsSha256: createHash('sha256').update(bytes).digest('hex'),
  }
  await writeFile(filename, `${JSON.stringify(evidence, null, 2)}\n`)
  return evidence
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const host = process.argv[2]
  await runImportsConsumer(host, process.env.WEAPP_VITE_CONSUMER_EVIDENCE || `.cache/imports-consumer-${host}.json`)
}
