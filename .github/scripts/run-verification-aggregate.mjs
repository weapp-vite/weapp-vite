import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

/** 启动前绑定执行包、冻结计划和可信 workflow 传入的 checkout 身份。 */
export async function runVerificationAggregate(options) {
  const directory = await realpath(options.bundle)
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'))
  const plan = JSON.parse(await readFile(options.plan, 'utf8'))
  assert(manifest.schemaVersion === 1 && manifest.toolVersion === plan.toolVersion && manifest.entry === 'aggregate.mjs'
    && /^[a-f\d]{64}$/u.test(manifest.sha256) && /^[a-f\d]{40}$/u.test(options.sha)
    && manifest.commitSha === options.sha && plan.commitSha === options.sha && manifest.runId === plan.runId
    && manifest.planHash === plan.planHash && isDeepStrictEqual(manifest.profile, plan.profile)
    && isDeepStrictEqual(manifest.executionTopology, plan.executionTopology), 'Aggregate execution bundle does not match the frozen plan or checkout')
  assert(plan.profile.os === process.platform && plan.profile.arch === process.arch
    && plan.profile.nodeMajor === Number(process.versions.node.split('.')[0]), 'Aggregate execution platform differs from the frozen plan')
  const entry = path.join(directory, manifest.entry)
  assert(await realpath(entry) === entry, 'Aggregate entry cannot be a symbolic link')
  assert(createHash('sha256').update(await readFile(entry)).digest('hex') === manifest.sha256, 'Aggregate execution bundle digest mismatch')
  const { runStandaloneAggregate } = await import(pathToFileURL(entry).href)
  await runStandaloneAggregate(options)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = Object.fromEntries(['bundle', 'plan', 'reports', 'output', 'sha'].map(key => [key, process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3)]))
  assert(Object.values(options).every(value => typeof value === 'string' && value), 'Missing aggregate execution argument')
  await runVerificationAggregate(options)
}
