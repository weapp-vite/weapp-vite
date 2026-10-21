import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import AdmZip from 'adm-zip'

const positiveInteger = value => Number.isSafeInteger(value) && value > 0

/** REST 没有 artifact attempt 字段，先核验全量身份，再以当前轮时间窗隔离旧归档。 */
export function currentAttemptArtifacts(artifacts, run) {
  const start = Date.parse(run.run_started_at)
  const end = Date.parse(run.updated_at)
  assert(Number.isFinite(start) && Number.isFinite(end) && end >= start, 'Invalid CI artifact attempt interval')
  for (const artifact of artifacts) {
    assert(positiveInteger(artifact?.id) && typeof artifact.name === 'string' && artifact.name
      && artifact.workflow_run?.id === run.id && artifact.workflow_run.head_sha === run.head_sha
      && artifact.workflow_run.repository_id === run.repository.id
      && artifact.workflow_run.head_repository_id === run.head_repository.id
      && artifact.workflow_run.head_branch === run.head_branch
      && Number.isFinite(Date.parse(artifact.created_at)) && Date.parse(artifact.created_at) <= end, 'Untrusted CI artifact identity or creation time')
  }
  const current = artifacts.filter(artifact => Date.parse(artifact.created_at) >= start)
  assert(new Set(current.map(artifact => artifact.name)).size === current.length
    && current.every(artifact => artifact.expired === false), 'Duplicated or expired current-attempt CI artifact')
  return current
}

export function validateArtifact(artifacts, name, run) {
  const matches = currentAttemptArtifacts(artifacts.filter(artifact => artifact.name === name), run)
  assert(matches.length === 1, `Missing, duplicated, stale or untrusted CI artifact: ${name}`)
  return matches[0]
}

/** run_attempt 可能标记复用作业；必须同时核对本轮实际执行时间。 */
export function validateCurrentAttemptJobs(jobs, run) {
  const start = Date.parse(run.run_started_at)
  const end = Date.parse(run.updated_at)
  assert(jobs.length && Number.isFinite(start) && Number.isFinite(end) && start <= end
    && jobs.every((job) => {
      const started = Date.parse(job.started_at)
      const completed = Date.parse(job.completed_at)
      return job.run_id === run.id && job.run_attempt === run.run_attempt && job.status === 'completed'
        && (job.conclusion === 'skipped' || (job.conclusion === 'success'
          && Number.isFinite(started) && Number.isFinite(completed) && start <= started && started <= completed && completed <= end))
    }), 'CI jobs are missing current-attempt execution identity; rerun all jobs')
}

/** 先核验全部目录项，避免平台别名、链接或祖先文件冲突造成跨目录写入。 */
export function validateArchiveEntries(entries) {
  const names = new Map()
  let size = 0
  const plan = entries.map((entry) => {
    assert(typeof entry.entryName === 'string' && entry.isDirectory === entry.entryName.endsWith('/'), 'Invalid CI artifact archive entry name')
    const name = entry.isDirectory ? entry.entryName.slice(0, -1) : entry.entryName
    const parts = name.split('/')
    assert(name && !/[\\<>:"|?*]/u.test(name) && [...name].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127) && !path.posix.isAbsolute(name)
      && !path.win32.isAbsolute(name) && parts.every(part => part && part !== '.' && part !== '..'
        && !/[. ]$/u.test(part) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part)), 'Unsafe CI artifact archive path')
    const key = name.normalize('NFC').toLowerCase()
    assert(!names.has(key), 'Duplicate or aliased CI artifact archive path')
    names.set(key, entry.isDirectory)
    const type = (entry.attr >>> 16) & 0o170000
    assert([0, 0o100000, 0o040000].includes(type)
      && (type !== 0o040000 || entry.isDirectory) && (type !== 0o100000 || !entry.isDirectory), 'Unsupported CI artifact archive entry type')
    assert(Number.isSafeInteger(entry.header.size) && entry.header.size >= 0
      && entry.header.size <= 512 * 1024 ** 2, 'CI artifact archive entry exceeds extraction budget')
    size += entry.header.size
    assert(size <= 8 * 1024 ** 3, 'CI artifact archive exceeds extraction budget')
    return { entry, name, key }
  })
  for (const { key } of plan) {
    const parts = key.split('/')
    for (let index = 1; index < parts.length; index++) {
      assert(names.get(parts.slice(0, index).join('/')) !== false, 'CI artifact archive has a file ancestor conflict')
    }
  }
  return plan
}

/** 精确 ID 下载后核验 REST 大小和摘要，再解压至本轮独占目录。 */
export async function extractArtifactArchive(filename, directory, artifact) {
  const info = await stat(filename)
  assert(Number.isSafeInteger(artifact.size_in_bytes) && info.size === artifact.size_in_bytes
    && /^sha256:[a-f\d]{64}$/u.test(artifact.digest ?? ''), 'CI artifact archive size or digest metadata mismatch')
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(filename)) {
    hash.update(bytes)
  }
  assert(`sha256:${hash.digest('hex')}` === artifact.digest, 'CI artifact archive digest mismatch')
  const entries = validateArchiveEntries(new AdmZip(filename).getEntries())
  await mkdir(directory)
  for (const { entry, name } of entries) {
    const target = path.join(directory, ...name.split('/'))
    if (entry.isDirectory) {
      await mkdir(target, { recursive: true })
    }
    else {
      const bytes = entry.getData()
      assert(bytes.length === entry.header.size, 'CI artifact archive entry size mismatch')
      assert(crc32(bytes) === entry.header.crc, 'CI artifact archive entry CRC mismatch')
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, bytes, { flag: 'wx' })
    }
  }
}
