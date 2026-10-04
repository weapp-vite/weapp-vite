import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 安装器需在 Windows 正确解析 pnpm 命令，不使用 shell 拼接。
import { execa } from 'execa'
import { parse } from 'yaml'
import { readConsumerTarballs } from '../../packages/weapp-vite/scripts/consumerTarballs.mjs'
import { redactSequenceEvidence } from '../editSequence/evidenceRedaction.ts'
import { assertConsumerOutput, kinds, writeFixture } from './fixtures.mjs'
import { inspectDependencyGraph, inspectInstallation, resolveInstalledPackage } from './graph.mjs'
import { archiveFingerprint, assertCandidateIntegrity, assertConsumerInputs, snapshotConsumerInputs } from './identity.mjs'
import { buildConsumerSummary, inventoryOutput } from './report.mjs'

const [operation, directory, tarballs] = process.argv.slice(2)
assert(['prepare', 'measure'].includes(operation) && directory, 'Usage: node --import tsx scripts/provider-consumer-cost/index.mjs prepare <new directory> <candidate tarballs> | measure <prepared directory>')
const root = path.resolve(directory)
const manifestFile = path.join(root, 'consumers.json')
async function save(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(redactSequenceEvidence(value, root), null, 2)}\n`)
}

if (operation === 'prepare') {
  assert(tarballs, 'prepare requires the existing consumer-tarballs.json directory')
  const candidates = await readConsumerTarballs(path.resolve(tarballs), ['weapp-vite', 'wevu'])
  // 不复用已有目录或工作区；失败时保留本轮目录供诊断，避免覆盖其他任务消费者。
  await mkdir(path.dirname(root), { recursive: true })
  await mkdir(root)
  const archiveManifest = JSON.parse(await readFile(path.join(path.resolve(tarballs), 'consumer-tarballs.json'), 'utf8'))
  const provenance = {}
  for (const [name, specifier] of Object.entries(candidates)) {
    const content = await readFile(specifier.slice('file:'.length))
    provenance[name] = { version: archiveManifest.packages[name].version, archive: path.basename(specifier), ...archiveFingerprint(content) }
  }
  const state = { schemaVersion: 1, status: 'preparing', node: process.version, platform: process.platform, arch: process.arch, provenance, consumers: [] }
  try {
    for (const kind of kinds) {
      const consumer = path.join(root, kind)
      const files = await writeFixture(consumer, kind, candidates)
      const entry = { kind, directory: kind, status: 'installing', ...snapshotConsumerInputs(files) }
      state.consumers.push(entry)
      await save(manifestFile, state)
      console.info(`Installing ${kind} consumer with strict dependencies`)
      const started = performance.now()
      const result = await execa('pnpm', ['install', '--strict-peer-dependencies', '--reporter', 'append-only'], {
        cwd: consumer,
        reject: false,
        timeout: 600_000,
        maxBuffer: 32 * 1024 * 1024,
        env: { npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false', npm_config_engine_strict: 'true' },
      })
      entry.installWallMs = performance.now() - started
      entry.status = result.exitCode === 0 ? 'installed' : 'failed'
      await save(path.join(root, `${kind}-install.json`), { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr })
      assert.equal(result.exitCode, 0, `Strict consumer installation failed: ${kind}`)
      const graph = await inspectDependencyGraph(consumer)
      entry.candidates = []
      const lock = parse(await readFile(path.join(consumer, 'pnpm-lock.yaml'), 'utf8'))
      for (const node of graph.nodes.filter(node => candidates[node.name])) {
        assertCandidateIntegrity(node.name, node.version, provenance[node.name], lock)
        entry.candidates.push({ name: node.name, version: node.version, archiveSha256: provenance[node.name].sha256 })
      }
      entry.lockSha256 = createHash('sha256').update(await readFile(path.join(consumer, 'pnpm-lock.yaml'))).digest('hex')
    }
    state.status = 'installed'
    console.info('All four consumer installations passed')
  }
  catch (error) {
    state.status = 'failed'
    state.error = error instanceof Error ? error.message : String(error)
    console.error(redactSequenceEvidence(state.error, root))
    process.exitCode = 1
  }
  finally {
    await save(manifestFile, state)
  }
}
else {
  const prepared = JSON.parse(await readFile(manifestFile, 'utf8'))
  assert(prepared.schemaVersion === 1 && prepared.status === 'installed', 'Expected a completely installed four-consumer manifest')
  assert.deepEqual(prepared.consumers.map(item => item.kind), kinds, 'Must measure all four consumers in declared order')
  const identities = new Set()
  const report = { schemaVersion: 1, status: 'running', node: process.version, platform: process.platform, arch: process.arch, provenance: prepared.provenance, consumers: [] }
  const reportFile = path.join(root, 'cost-report.json')
  try {
    for (const entry of prepared.consumers) {
      assert(entry.directory === entry.kind, 'Invalid consumer directory')
      const consumer = await realpath(path.join(root, entry.directory))
      assert(!identities.has(consumer), 'Each capability requires its own installed consumer')
      identities.add(consumer)
      const result = { kind: entry.kind, status: 'running', inputSha256: entry.inputSha256, installWallMs: entry.installWallMs, lockSha256: entry.lockSha256, candidates: entry.candidates, uninstrumentedSamples: [] }
      report.consumers.push(result)
      assert.equal(createHash('sha256').update(await readFile(path.join(consumer, 'pnpm-lock.yaml'))).digest('hex'), entry.lockSha256, 'Consumer lock changed after preparation')
      await assertConsumerInputs(consumer, entry)
      result.installation = await inspectInstallation(consumer)
      result.graph = await inspectDependencyGraph(consumer)
      const cliPackage = await resolveInstalledPackage(consumer, consumer, 'weapp-vite')
      assert(cliPackage, 'Missing installed weapp-vite')
      const cli = path.join(cliPackage.directory, 'bin/weapp-vite.js')
      const args = [cli, 'build', '--config', 'weapp-vite.config.mjs']
      let baseline
      for (let sample = 0; sample < 5; sample++) {
        const started = performance.now()
        const command = await execa(process.execPath, args, { cwd: consumer, reject: false, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
        result.uninstrumentedSamples.push({ sample, wallMs: performance.now() - started, exitCode: command.exitCode })
        await save(path.join(root, `${entry.kind}-build-${sample}.json`), { exitCode: command.exitCode, stdout: command.stdout, stderr: command.stderr })
        assert.equal(command.exitCode, 0, `Consumer production build failed: ${entry.kind}`)
        await assertConsumerOutput(consumer, entry.kind)
        const output = await inventoryOutput(path.join(consumer, 'dist'))
        if (baseline) {
          assert.deepEqual(output, baseline, 'Repeated builds changed output bytes')
        }
        baseline = output
      }
      const traceFile = path.join(consumer, 'provider-cost-trace.json')
      const command = await execa(process.execPath, ['--import', new URL('./trace.mjs', import.meta.url).href, ...args], {
        cwd: consumer,
        reject: false,
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
        env: { PROVIDER_COST_ROOT: consumer, PROVIDER_COST_TRACE: traceFile },
      })
      await save(path.join(root, `${entry.kind}-instrumented-build.json`), { exitCode: command.exitCode, stdout: command.stdout, stderr: command.stderr })
      assert.equal(command.exitCode, 0, `Instrumented consumer build failed: ${entry.kind}`)
      result.trace = JSON.parse(await readFile(traceFile, 'utf8'))
      result.summary = buildConsumerSummary(result.graph, result.trace)
      await assertConsumerOutput(consumer, entry.kind)
      assert.deepEqual(await inventoryOutput(path.join(consumer, 'dist')), baseline, 'Instrumentation changed output bytes')
      result.output = baseline
      result.measurement = 'five separate production build processes; first sample listed separately; filesystem and package-manager caches not flushed; trace collected in an additional process'
      result.status = 'passed'
      await save(reportFile, report)
    }
    report.status = 'passed'
  }
  catch (error) {
    report.status = 'failed'
    report.error = error instanceof Error ? error.message : String(error)
    if (report.consumers.at(-1)?.status === 'running') {
      report.consumers.at(-1).status = 'failed'
    }
    process.exitCode = 1
  }
  finally {
    await save(reportFile, report)
  }
}
