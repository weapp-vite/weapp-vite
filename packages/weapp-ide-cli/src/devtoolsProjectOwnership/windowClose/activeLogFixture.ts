import type { ManagedWechatHostIdentity, ManagedWechatProjectRecord } from '../types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export async function descriptor(filename: string, overrides: Partial<Record<'f' | 'a' | 't' | 'D' | 'i' | 'k' | 'n', string>> = {}) {
  const stat = await fs.stat(filename, { bigint: true })
  const fields = { f: '25', a: 'w', t: 'REG', D: `0x${stat.dev.toString(16)}`, i: String(stat.ino), k: String(stat.nlink), n: filename, ...overrides }
  return `${Object.entries(fields).map(([key, value]) => `${key}${value}\0`).join('')}\n`
}

export async function createActiveLogFixture() {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'active-main-log-')))
  const bundle = path.join(directory, 'selected.app')
  const appPath = path.join(bundle, 'Contents', 'Resources', 'app.asar')
  const cliPath = path.join(bundle, 'Contents', 'MacOS', 'cli')
  const logDirectory = path.join(directory, 'selected-profile', 'WeappLog', 'logs')
  const logFile = path.join(logDirectory, 'current.log')
  const main: ManagedWechatHostIdentity = { pid: process.pid + 1, started: 'Mon Oct 5 12:30:01 2026', executable: path.join(bundle, 'Contents', 'MacOS', 'Electron') }
  const backend: ManagedWechatHostIdentity = { pid: process.pid + 2, started: 'Mon Oct 5 12:30:02 2026', executable: path.join(bundle, 'Contents', 'Frameworks', 'Helper') }
  for (const executable of [main.executable, backend.executable, appPath, cliPath]) {
    await fs.mkdir(path.dirname(executable), { recursive: true })
    await fs.writeFile(executable, '')
  }
  await fs.mkdir(logDirectory, { recursive: true })
  await fs.writeFile(logFile, '[timestamp][INFO][2.02.2608070][BACKEND] simulator initialization\n')
  const now = new Date().toISOString()
  const record: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id: randomUUID(),
    generation: randomUUID(),
    journalPath: path.join(directory, 'journal'),
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    target: { cliPath, appPath, installationId: 'selected', version: '2.02.2608070', profileDir: path.dirname(path.dirname(logDirectory)) },
    projectPath: path.join(directory, 'project'),
    state: 'owned',
    host: { ...backend },
    createdAt: now,
    updatedAt: now,
  }
  return { directory, logDirectory, logFile, main, backend, record }
}
