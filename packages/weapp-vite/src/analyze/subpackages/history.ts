import type { ConfigService } from '../../runtime/config/types'
import type { AnalyzeSubpackagesResult } from './types'
import fs from 'node:fs/promises'
import path from 'pathe'
import { resolveAnalyzeHistoryMetadata } from './metadata'

const jsonExtension = '.json'

function createSnapshotFileName(date = new Date()) {
  return `${date.toISOString().replace(/[:.]/g, '-')}${jsonExtension}`
}

function isAnalyzeResult(value: unknown): value is AnalyzeSubpackagesResult {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray((value as AnalyzeSubpackagesResult).packages)
    && Array.isArray((value as AnalyzeSubpackagesResult).modules)
    && Array.isArray((value as AnalyzeSubpackagesResult).subPackages),
  )
}

async function listSnapshotFiles(dir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith(jsonExtension))
      .map(entry => path.join(dir, entry.name))
      .sort((a, b) => b.localeCompare(a))
  }
  catch {
    return []
  }
}

async function trimSnapshotFiles(dir: string, limit: number) {
  const files = await listSnapshotFiles(dir)
  const staleFiles = files.slice(limit)
  await Promise.all(staleFiles.map(async (file) => {
    try {
      await fs.unlink(file)
    }
    catch { }
  }))
}

export async function readLatestAnalyzeHistorySnapshot(configService: ConfigService) {
  const history = resolveAnalyzeHistoryMetadata(configService)
  if (!history.enabled) {
    return null
  }

  const files = await listSnapshotFiles(history.dir)
  for (const file of files) {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as unknown
      if (isAnalyzeResult(parsed)) {
        return parsed
      }
    }
    catch { }
  }

  return null
}

export async function writeAnalyzeHistorySnapshot(
  result: AnalyzeSubpackagesResult,
  configService: ConfigService,
  now = new Date(),
) {
  const history = resolveAnalyzeHistoryMetadata(configService)
  if (!history.enabled) {
    return undefined
  }

  await fs.mkdir(history.dir, { recursive: true })
  const snapshotPath = path.join(history.dir, createSnapshotFileName(now))
  if (result.metadata) {
    result.metadata = {
      ...result.metadata,
      history: {
        ...history,
        dir: configService.relativeCwd(history.dir),
        latestSnapshot: configService.relativeCwd(snapshotPath),
      },
    }
  }
  await fs.writeFile(snapshotPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await trimSnapshotFiles(history.dir, history.limit)
  return snapshotPath
}
