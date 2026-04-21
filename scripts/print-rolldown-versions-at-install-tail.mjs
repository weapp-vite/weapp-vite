#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

import { main as printRolldownVersions } from './print-rolldown-versions.mjs'

const WAIT_INTERVAL_MS = 300
const WAIT_TIMEOUT_MS = 5 * 60 * 1000
const PNPM_COMMAND_PATTERN = /\bpnpm(?:\.cjs)?\b/
const INSTALL_COMMAND_PATTERN = /\b(?:i|install)\b/
const LIFECYCLE_COMMAND_PATTERN = /(?:^|[\s'"])(?:preinstall|install|postinstall|prepare)(?=$|[\s'"])/
const PS_COMMAND_PATTERN = /\bps\s+-eo\b/
const MAX_WAIT_LOG_COMMANDS = 3

function parseProcessLine(line) {
  const trimmedLine = line.trimStart()
  if (!trimmedLine) {
    return null
  }

  const firstSpaceIndex = trimmedLine.indexOf(' ')
  if (firstSpaceIndex === -1) {
    return null
  }

  const pidText = trimmedLine.slice(0, firstSpaceIndex)
  const rest = trimmedLine.slice(firstSpaceIndex).trimStart()
  const secondSpaceIndex = rest.indexOf(' ')
  if (secondSpaceIndex === -1) {
    return null
  }

  const ppidText = rest.slice(0, secondSpaceIndex)
  const command = rest.slice(secondSpaceIndex).trimStart()
  if (!pidText || !ppidText || !command) {
    return null
  }

  return {
    pid: Number(pidText),
    ppid: Number(ppidText),
    command,
  }
}

function listProcesses() {
  let output = ''
  try {
    output = execFileSync('ps', ['-eo', 'pid=,ppid=,command='], {
      encoding: 'utf8',
    })
  }
  catch {
    return []
  }

  return output
    .split('\n')
    .map(parseProcessLine)
    .filter(Boolean)
}

function buildProcessIndex(processes) {
  return new Map(processes.map(processInfo => [processInfo.pid, processInfo]))
}

function collectAncestors(processIndex, pid) {
  const ancestors = []
  let currentPid = pid
  while (currentPid > 0) {
    const processInfo = processIndex.get(currentPid)
    if (!processInfo) {
      break
    }
    ancestors.push(processInfo)
    currentPid = processInfo.ppid
  }
  return ancestors
}

function isInstallCommand(command) {
  return PNPM_COMMAND_PATTERN.test(command) && INSTALL_COMMAND_PATTERN.test(command)
}

function isLifecycleCommand(command) {
  return LIFECYCLE_COMMAND_PATTERN.test(command)
}

function findInstallAncestor(ancestors) {
  return ancestors.find(processInfo => isInstallCommand(processInfo.command)) ?? null
}

function findLifecycleRootPid(ancestors, installAncestorPid) {
  for (let index = 0; index < ancestors.length - 1; index += 1) {
    if (ancestors[index + 1]?.pid === installAncestorPid) {
      return ancestors[index].pid
    }
  }
  return ancestors[0]?.pid ?? process.pid
}

function collectDescendantPids(processes, rootPid) {
  const childrenByParent = new Map()

  for (const processInfo of processes) {
    const siblings = childrenByParent.get(processInfo.ppid) ?? []
    siblings.push(processInfo.pid)
    childrenByParent.set(processInfo.ppid, siblings)
  }

  const descendants = new Set()
  const queue = [rootPid]

  while (queue.length > 0) {
    const currentPid = queue.shift()
    const childPids = childrenByParent.get(currentPid) ?? []
    for (const childPid of childPids) {
      if (descendants.has(childPid)) {
        continue
      }
      descendants.add(childPid)
      queue.push(childPid)
    }
  }

  return descendants
}

function listSiblingLifecycleProcesses(processes, installAncestorPid, lifecycleRootPid) {
  return processes.filter((processInfo) => {
    if (processInfo.ppid !== installAncestorPid || processInfo.pid === lifecycleRootPid) {
      return false
    }
    if (PS_COMMAND_PATTERN.test(processInfo.command)) {
      return false
    }
    return isLifecycleCommand(processInfo.command)
  })
}

function hasOtherLifecycleProcesses(processes, installAncestorPid, lifecycleRootPid) {
  return listSiblingLifecycleProcesses(processes, installAncestorPid, lifecycleRootPid).length > 0
}

function summarizeLifecycleCommand(command) {
  const shellCommandSeparator = ' -c '
  const shellCommandIndex = command.indexOf(shellCommandSeparator)

  if (shellCommandIndex === -1) {
    return command.trim()
  }

  return command.slice(shellCommandIndex + shellCommandSeparator.length).trim()
}

function logWaitForInstallTail(pendingLifecycleProcesses) {
  const summarizedCommands = pendingLifecycleProcesses
    .slice(0, MAX_WAIT_LOG_COMMANDS)
    .map(processInfo => summarizeLifecycleCommand(processInfo.command))
  const remainingCount = pendingLifecycleProcesses.length - summarizedCommands.length
  const remainingLabel = remainingCount > 0 ? ` 等 ${remainingCount} 个` : ''

  console.log([
    `[workspace] waiting for remaining workspace lifecycle scripts before rolldown report (${pendingLifecycleProcesses.length})${remainingLabel}:`,
    ...summarizedCommands.map(command => `- ${command}`),
  ].join('\n'))
}

async function waitForInstallTail() {
  const startedAt = Date.now()
  let hasLoggedWait = false

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    const processes = listProcesses()
    if (processes.length === 0) {
      return
    }
    const processIndex = buildProcessIndex(processes)
    const ancestors = collectAncestors(processIndex, process.pid)
    const installAncestor = findInstallAncestor(ancestors)

    if (!installAncestor) {
      return
    }

    const lifecycleRootPid = findLifecycleRootPid(ancestors, installAncestor.pid)
    const pendingLifecycleProcesses = listSiblingLifecycleProcesses(processes, installAncestor.pid, lifecycleRootPid)
    if (pendingLifecycleProcesses.length === 0) {
      return
    }
    if (!hasLoggedWait) {
      logWaitForInstallTail(pendingLifecycleProcesses)
      hasLoggedWait = true
    }

    await sleep(WAIT_INTERVAL_MS)
  }
}

async function main() {
  await waitForInstallTail()
  printRolldownVersions({ mode: 'warn' })
}

export {
  buildProcessIndex,
  collectAncestors,
  collectDescendantPids,
  findInstallAncestor,
  findLifecycleRootPid,
  hasOtherLifecycleProcesses,
  isInstallCommand,
  isLifecycleCommand,
  listProcesses,
  listSiblingLifecycleProcesses,
  logWaitForInstallTail,
  main,
  parseProcessLine,
  summarizeLifecycleCommand,
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
