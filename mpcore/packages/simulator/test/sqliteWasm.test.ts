import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createMemoryArtifactSource } from '../src/kernel'
import { createArtifactProject } from '../src/project'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { createSqliteWasmFiles } from './helpers/sqliteWasmFiles'

const directories: string[] = []
afterEach(() => cleanupTempDirs(directories))

it.each(['headless', 'browser'] as const)('executes real SQLite and reopens its persisted binary snapshot in %s', async (provider) => {
  const files = await createSqliteWasmFiles()
  const root = path.join(os.tmpdir(), 'mpcore-sqlite-memory-project')
  const session = provider === 'browser'
    ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    : createHeadlessSession({ project: createArtifactProject({
        miniprogramRootPath: root,
        artifactSource: createMemoryArtifactSource(files.map(([file, content]) => [path.join(root, file), content])),
      }) })
  const original = globalThis.WebAssembly
  try {
    const page = session.reLaunch('/pages/index')
    expect(await page.run()).toEqual({ value: 1303, text: '数据库', snapshot: true })
    expect(session.renderCurrentPage().wxml).toContain('数据库')
    expect(globalThis.WebAssembly).toBe(original)
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})

it.each(['shared', 'sqlite-engine'])('loads real SQLite through projectPath with an absolute /%s package WASM path', async (packageRoot) => {
  const files = await createSqliteWasmFiles(`${packageRoot}/assets/sql-wasm-lite.wasm`)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-sqlite-project-path-'))
  directories.push(root)
  fs.writeFileSync(path.join(root, 'project.config.json'), JSON.stringify({ miniprogramRoot: 'dist' }))
  for (const [file, content] of files) {
    const target = path.join(root, 'dist', file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof content === 'string' ? content : new Uint8Array(content))
  }
  const session = createHeadlessSession({ projectPath: root })
  try {
    const page = session.reLaunch('/pages/index')
    expect(await page.run()).toEqual({ value: 1303, text: '数据库', snapshot: true })
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
  }
})
