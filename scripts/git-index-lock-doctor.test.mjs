import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

import {
  assessIndexLock,
  cleanIndexLock,
  findActiveGitProcesses,
  parseProcessList,
} from './git-index-lock-doctor.mjs'

it('parses Unix and Windows process listings and detects Git processes', () => {
  assert.deepEqual(parseProcessList(' 101 1 /usr/bin/git status\n 102 1 node build.js\n', 'darwin'), [
    { pid: 101, ppid: 1, command: '/usr/bin/git status' },
    { pid: 102, ppid: 1, command: 'node build.js' },
  ])
  assert.deepEqual(parseProcessList('"git.exe","101","Console","1","10 K"\n', 'win32'), [
    { pid: 101, ppid: null, command: 'git.exe' },
  ])
  assert.deepEqual(findActiveGitProcesses([
    { pid: 101, command: '/usr/bin/git status' },
    { pid: 102, command: 'node build.js' },
  ]), [{ pid: 101, command: '/usr/bin/git status' }])
})

it('only cleans an old lock when no Git process is active', () => {
  const now = 1_000_000
  const staleState = assessIndexLock({
    lockPath: '/repo/.git/index.lock',
    now,
    staleMs: 10_000,
    activeProcesses: [],
    statSyncImpl: () => ({ mtimeMs: now - 20_000 }),
  })
  const removed = []
  assert.deepEqual(cleanIndexLock(staleState, {
    removeSyncImpl(filePath) {
      removed.push(filePath)
    },
  }), { removed: true, reason: 'stale-lock' })
  assert.deepEqual(removed, ['/repo/.git/index.lock'])

  const activeState = { ...staleState, activeProcesses: [{ pid: 10, command: 'git commit' }] }
  assert.deepEqual(cleanIndexLock(activeState, {
    removeSyncImpl() {
      throw new Error('must not remove active lock')
    },
  }), { removed: false, reason: 'active-git-process' })
})

it('does not treat a missing or recent lock as removable', () => {
  const missing = assessIndexLock({
    lockPath: '/repo/.git/index.lock',
    statSyncImpl: () => {
      const error = new Error('missing')
      error.code = 'ENOENT'
      throw error
    },
  })
  assert.deepEqual(cleanIndexLock(missing), { removed: false, reason: 'missing' })

  const recent = assessIndexLock({
    lockPath: '/repo/.git/index.lock',
    now: 1_000_000,
    staleMs: 10_000,
    statSyncImpl: () => ({ mtimeMs: 995_000 }),
  })
  assert.deepEqual(cleanIndexLock(recent), { removed: false, reason: 'recent-lock' })
})

it('keeps tracked postinstall files unchanged in check mode and syncs explicitly', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'workspace-postinstall-'))
  const generatedPath = path.join(root, 'packages/create-weapp-vite/src/generated/catalog.ts')
  const rootManifestPath = path.join(root, 'package.json')
  const webManifestPath = path.join(root, 'packages-runtime/web/package.json')
  const weappManifestPath = path.join(root, 'packages/weapp-vite/package.json')
  const requireManifestPath = path.join(root, 'packages/rolldown-require/package.json')

  try {
    mkdirSync(path.dirname(generatedPath), { recursive: true })
    mkdirSync(path.dirname(webManifestPath), { recursive: true })
    mkdirSync(path.dirname(weappManifestPath), { recursive: true })
    mkdirSync(path.dirname(requireManifestPath), { recursive: true })
    writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - packages-runtime/*\n')
    writeFileSync(rootManifestPath, JSON.stringify({ devDependencies: { rolldown: '1.0.0' } }))
    writeFileSync(webManifestPath, JSON.stringify({ dependencies: { rolldown: '1.0.0' } }))
    writeFileSync(weappManifestPath, JSON.stringify({ dependencies: { rolldown: '1.0.0' } }))
    writeFileSync(requireManifestPath, JSON.stringify({ peerDependencies: { rolldown: '1.0.0' } }))
    writeFileSync(generatedPath, 'stale generated content\n')

    const before = [rootManifestPath, webManifestPath, weappManifestPath, requireManifestPath, generatedPath]
      .map(filePath => [filePath, readFileSync(filePath, 'utf8')])
    const { runPostinstall } = await import('./postinstall-sync.mjs')
    const checkResult = await runPostinstall({ rootDir: root, mode: 'check' })
    assert.ok(checkResult.changedFiles.length > 0)
    assert.deepEqual(before.map(([filePath]) => [filePath, readFileSync(filePath, 'utf8')]), before)

    await runPostinstall({ rootDir: root, mode: 'sync' })
    assert.equal(JSON.parse(readFileSync(rootManifestPath, 'utf8')).devDependencies.rolldown, 'catalog:')
    assert.equal(JSON.parse(readFileSync(webManifestPath, 'utf8')).dependencies.rolldown, 'catalog:')
    assert.equal(JSON.parse(readFileSync(weappManifestPath, 'utf8')).dependencies.rolldown, 'catalog:')
    assert.equal(JSON.parse(readFileSync(requireManifestPath, 'utf8')).peerDependencies.rolldown, 'catalog:')
  }
  finally {
    rmSync(root, { force: true, recursive: true })
  }
})
