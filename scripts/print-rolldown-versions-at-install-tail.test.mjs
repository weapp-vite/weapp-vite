import assert from 'node:assert/strict'
import test from 'vitest'

import {
  collectAncestors,
  collectDescendantPids,
  findInstallAncestor,
  findLifecycleRootPid,
  hasOtherLifecycleProcesses,
  isInstallCommand,
  parseProcessLine,
} from './print-rolldown-versions-at-install-tail.mjs'

test('isInstallCommand matches pnpm install commands only', () => {
  assert.equal(isInstallCommand('node /path/pnpm.cjs install'), true)
  assert.equal(isInstallCommand('/bin/zsh -lc CI=1 pnpm i'), true)
  assert.equal(isInstallCommand('node /path/pnpm.cjs run postinstall'), false)
})

test('parseProcessLine extracts pid ppid and command', () => {
  assert.deepEqual(
    parseProcessLine('  123   45 node /path/pnpm.cjs install'),
    { pid: 123, ppid: 45, command: 'node /path/pnpm.cjs install' },
  )
  assert.equal(parseProcessLine(''), null)
})

test('process tree helpers identify install ancestor and lifecycle root', () => {
  const processes = [
    { pid: 100, ppid: 1, command: 'node /path/pnpm.cjs install' },
    { pid: 200, ppid: 100, command: 'sh -c website postinstall' },
    { pid: 300, ppid: 200, command: 'node scripts/print-rolldown-versions-at-install-tail.mjs' },
  ]
  const processIndex = new Map(processes.map(processInfo => [processInfo.pid, processInfo]))
  const ancestors = collectAncestors(processIndex, 300)

  assert.equal(findInstallAncestor(ancestors)?.pid, 100)
  assert.equal(findLifecycleRootPid(ancestors, 100), 200)
})

test('collectDescendantPids walks the full subtree', () => {
  const processes = [
    { pid: 1, ppid: 0, command: 'root' },
    { pid: 2, ppid: 1, command: 'child-a' },
    { pid: 3, ppid: 1, command: 'child-b' },
    { pid: 4, ppid: 2, command: 'grandchild' },
  ]

  assert.deepEqual([...collectDescendantPids(processes, 1)].sort((a, b) => a - b), [2, 3, 4])
})

test('hasOtherLifecycleProcesses ignores current subtree and waits for siblings', () => {
  const processes = [
    { pid: 100, ppid: 1, command: 'node /path/pnpm.cjs install' },
    { pid: 200, ppid: 100, command: 'sh -c website postinstall' },
    { pid: 210, ppid: 200, command: 'node scripts/print-rolldown-versions-at-install-tail.mjs' },
    { pid: 300, ppid: 100, command: 'sh -c templates/weapp-vite-wevu-template postinstall' },
  ]

  assert.equal(hasOtherLifecycleProcesses(processes, 100, 200), true)
  assert.equal(hasOtherLifecycleProcesses(processes.filter(processInfo => processInfo.pid !== 300), 100, 200), false)
})
