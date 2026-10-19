import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 保留原任务的跨平台启动与取消行为。
import { execa } from 'execa'
import { createBuildArtifactManifest, verifyBuildArtifactManifest } from '../buildArtifact/index.mjs'
import { readTurboEvidence } from '../verification/evidence.ts'
import { localIdentity } from './localFiles.mjs'
import { localDigest, localDocument, localRelative, localSave } from './localIo.mjs'
import { localDryGraph, localTurboSummary, validateLocalTurbo } from './localTurbo.mjs'

/**
 * 专用采样保持原命令、环境与退出行为，只给静态检查添加 JSON 输出格式。
 * @returns {Promise<{ exitCode: number } & Partial<Pick<import('../verification/types.ts').TaskResult, 'execution' | 'subtasks'>>>} 实际进程与执行证据。
 */
export async function executeLocalTask(root, task, signal, jsonOutput) {
  const directory = process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR
  const runId = process.env.WEAPP_VITE_VERIFICATION_LOCAL_RUN
  assert(root === process.env.WEAPP_VITE_VERIFICATION_LOCAL_ROOT && directory && runId, 'Local task observer has no owned root or run')
  localRelative(root, directory)
  const invocationId = randomUUID()
  const taskDirectory = path.join(directory, 'tasks', invocationId)
  await mkdir(taskDirectory, { recursive: true })
  const before = localIdentity(root, runId)
  const env = { ...task.env, WEAPP_VITE_VERIFICATION_LOCAL_TASK: task.id, WEAPP_VITE_VERIFICATION_LOCAL_INVOCATION: invocationId }
  const buildEnv = { BUILD_ARTIFACT_EXPECTED_COMMIT: before.commitSha, BUILD_ARTIFACT_PACKAGE_MANAGER: process.env.WEAPP_VITE_VERIFICATION_LOCAL_PNPM }
  const receipt = { schemaVersion: 1, runId, taskId: task.id, invocationId, nodeVersion: process.version, sourceFingerprint: before.fingerprint, command: task.command, args: task.args, effectiveArgs: [...task.args], directory: task.directory, startedAt: new Date().toISOString() }
  let output = ''
  let stderr = ''
  let result
  let failure
  const destination = jsonOutput ? process.stderr : process.stdout
  try {
    if (process.env.WEAPP_VITE_VERIFICATION_LOCAL_MODE === 'full' && task.kind !== 'build' && task.dependencies.length) {
      const latest = await localDocument(root, path.join(directory, 'artifacts/latest.json'))
      verifyBuildArtifactManifest(root, latest.value, buildEnv)
      assert.deepEqual(createBuildArtifactManifest(root, buildEnv), latest.value, 'Prepared artifact inventory changed before a consumer')
      receipt.preparedArtifacts = { path: latest.path, digest: latest.digest, value: latest.value }
    }
    if (task.evidence) {
      receipt.dryGraph = await localDryGraph(root, task, env)
    }
    if (['lint', 'stylelint'].includes(task.kind)) {
      receipt.lintReport = localRelative(root, path.join(taskDirectory, 'lint.json'))
      receipt.effectiveArgs.push('--format=json', `--output-file=${path.join(root, receipt.lintReport)}`)
      if (task.kind === 'stylelint') {
        receipt.effectiveArgs.splice(-2, 1, '--formatter=json')
      }
    }
    const child = execa(task.command, receipt.effectiveArgs, { cwd: path.resolve(root, task.directory), env, stdin: 'inherit', stdout: 'pipe', stderr: 'pipe', buffer: false, reject: false, cancelSignal: signal })
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      destination.write(chunk)
      output += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      process.stderr.write(chunk)
      stderr += chunk
    })
    result = await child
    receipt.exitCode = result.exitCode ?? 1
    receipt.signal = result.signal ?? null
    receipt.cancelled = Boolean(result.isCanceled || signal?.aborted)
    if (result.exitCode === 0 && task.evidence) {
      receipt.summary = await localTurboSummary(root, output)
      receipt.leaves = validateLocalTurbo(receipt.dryGraph, receipt.summary.value)
    }
    const artifactWriter = ['build', 'types'].includes(task.kind) || receipt.dryGraph?.tasks.some(node => node.taskId.endsWith('#build') && node.command !== '<NONEXISTENT>')
    if (result.exitCode === 0 && artifactWriter) {
      receipt.artifacts = createBuildArtifactManifest(root, buildEnv)
      await localSave(path.join(directory, 'artifacts/latest.json'), receipt.artifacts)
    }
    else if (result.exitCode === 0 && receipt.preparedArtifacts) {
      verifyBuildArtifactManifest(root, receipt.preparedArtifacts.value, buildEnv)
      assert.deepEqual(createBuildArtifactManifest(root, buildEnv), receipt.preparedArtifacts.value, 'Prepared artifact inventory changed inside a consumer')
    }
    assert(localIdentity(root, runId).fingerprint === before.fingerprint, 'Source changed inside a local verification task')
    if (result.exitCode === 0 && task.id === 'dist-sync:weapp-vite') {
      process.stderr.write('dist sync: rebuilt weapp-vite before downstream validation\n')
    }
  }
  catch (error) {
    failure = error
    receipt.error = error instanceof Error ? error.message : String(error)
    receipt.exitCode ??= 1
    receipt.cancelled ??= Boolean(signal?.aborted)
  }
  finally {
    receipt.finishedAt = new Date().toISOString()
    for (const [name, bytes] of [['stdout', output], ['stderr', stderr]]) {
      const file = path.join(taskDirectory, `${name}.log`)
      await writeFile(file, bytes)
      receipt[name] = { path: localRelative(root, file), digest: localDigest(bytes) }
    }
    await localSave(path.join(taskDirectory, 'receipt.json'), receipt)
  }
  if (failure) {
    throw failure
  }
  const evidence = task.evidence ? await readTurboEvidence(root, output) : { execution: 'actual' }
  return { exitCode: result.exitCode ?? 1, ...evidence }
}
