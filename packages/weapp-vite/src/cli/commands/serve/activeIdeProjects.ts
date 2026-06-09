import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

interface ActiveIdeProjectRecord {
  pid: number
  projectPath: string
  updatedAt: string
}

const ACTIVE_IDE_PROJECTS_DIR = path.join(os.tmpdir(), 'weapp-vite-active-dev-open-projects')

function normalizeProjectPath(projectPath: string) {
  return path.resolve(projectPath)
}

function resolveRecordPath(projectPath: string) {
  return path.join(ACTIVE_IDE_PROJECTS_DIR, `${Buffer.from(normalizeProjectPath(projectPath)).toString('base64url')}.json`)
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') {
      return false
    }
    return true
  }
}

async function readRecord(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const record = JSON.parse(raw) as Partial<ActiveIdeProjectRecord>
    if (typeof record.pid !== 'number' || typeof record.projectPath !== 'string') {
      return null
    }
    return record as ActiveIdeProjectRecord
  }
  catch {
    return null
  }
}

/**
 * @description 登记当前 dev:open 项目，供后续启动判断是否需要保留其它正在运行的 IDE 窗口。
 */
export async function registerActiveServeIdeProject(projectPath: string) {
  const filePath = resolveRecordPath(projectPath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify({
    pid: process.pid,
    projectPath: normalizeProjectPath(projectPath),
    updatedAt: new Date().toISOString(),
  } satisfies ActiveIdeProjectRecord, null, 2)}\n`, 'utf8')

  return async () => {
    await fs.rm(filePath, { force: true }).catch(() => {})
  }
}

/**
 * @description 检查是否存在其它仍在运行的 dev:open 项目。
 */
export async function hasOtherActiveServeIdeProject(projectPath: string) {
  const currentProjectPath = normalizeProjectPath(projectPath)
  let entries: string[]

  try {
    entries = await fs.readdir(ACTIVE_IDE_PROJECTS_DIR)
  }
  catch {
    return false
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue
    }

    const filePath = path.join(ACTIVE_IDE_PROJECTS_DIR, entry)
    const record = await readRecord(filePath)
    if (!record || !isProcessAlive(record.pid)) {
      await fs.rm(filePath, { force: true }).catch(() => {})
      continue
    }
    if (normalizeProjectPath(record.projectPath) !== currentProjectPath) {
      return true
    }
  }

  return false
}
