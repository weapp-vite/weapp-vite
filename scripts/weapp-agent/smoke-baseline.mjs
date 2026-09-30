/* eslint-disable antfu/no-import-dist -- Validate the shipped model-free bundle on minimum Node versions. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { AcceptanceService } from '../../packages/acceptance/dist/index.mjs'

const root = await mkdtemp(path.join(tmpdir(), 'acceptance-baseline-'))
process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')
let service
try {
  const project = path.join(root, 'project')
  await mkdir(project)
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ dependencies: { 'weapp-vite': '7.4.0' } }))
  await writeFile(path.join(project, 'weapp-acceptance.config.json'), JSON.stringify({ verification: [{ kind: 'build', command: process.execPath, args: ['-e', 'console.log("ok")'] }], acceptance: { requiredChecks: ['build'] } }))
  await writeFile(path.join(project, 'vite.config.ts'), 'throw new Error("Inspection must not evaluate Vite configuration")')
  const cli = fileURLToPath(new URL('../../packages/weapp-vite/bin/weapp-vite.js', import.meta.url))
  const inspection = JSON.parse(execFileSync(process.execPath, [cli, 'accept', project, '--inspect', '--json'], { encoding: 'utf8' }))
  assert.equal(inspection.modelRequired, false)
  service = await AcceptanceService.create(project, { trust: true })
  assert.equal((await service.inspect()).modelRequired, false)
  const result = await service.wait((await service.start()).jobId)
  assert.equal(result.passed, true, JSON.stringify(result))
  console.log(`PASS no-model acceptance on ${process.version}`)
}
finally {
  await service?.close()
  await rm(root, { recursive: true, force: true })
}
