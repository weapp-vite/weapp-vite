#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

const EXPECTED_ROLLDOWN_REQUIRE_PEER = '>=1.0.0-rc.9'
const ANSI = {
  reset: '\x1B[0m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  magenta: '\x1B[35m',
  cyan: '\x1B[36m',
}

function colorize(text, ...codes) {
  return `${codes.join('')}${text}${ANSI.reset}`
}

function stripPeerSuffix(version = '') {
  const index = version.indexOf('(')
  return index === -1 ? version : version.slice(0, index)
}

function isExternalReference(version = '') {
  return version.startsWith('link:')
    || version.startsWith('file:')
    || version.startsWith('workspace:')
    || version.startsWith('portal:')
}

function createNodeLabel(name, version, importerPath) {
  if (importerPath) {
    return importerPath
  }
  return `${name}@${stripPeerSuffix(version)}`
}

function enqueueDependencies(queue, dependencyEntries, parentLabel) {
  for (const [name, value] of Object.entries(dependencyEntries ?? {})) {
    const version = typeof value === 'string' ? value : value?.version
    if (typeof version !== 'string' || isExternalReference(version)) {
      continue
    }
    queue.push({
      importerPath: null,
      name,
      parentLabel,
      version,
    })
  }
}

function collectRolldownVersions(lockfile) {
  const snapshots = lockfile.snapshots ?? {}
  const importers = lockfile.importers ?? {}
  const queue = []
  const visitedSnapshots = new Set()
  const versions = new Map()

  for (const [importerPath, importer] of Object.entries(importers)) {
    enqueueDependencies(queue, importer.dependencies, importerPath)
    enqueueDependencies(queue, importer.devDependencies, importerPath)
    enqueueDependencies(queue, importer.optionalDependencies, importerPath)
  }

  while (queue.length > 0) {
    const current = queue.shift()
    const resolvedVersion = stripPeerSuffix(current.version)

    if (current.name === 'rolldown') {
      const requiredBy = versions.get(resolvedVersion) ?? new Set()
      requiredBy.add(current.parentLabel ?? createNodeLabel(current.name, current.version, current.importerPath))
      versions.set(resolvedVersion, requiredBy)
    }

    const snapshotKey = `${current.name}@${current.version}`
    if (visitedSnapshots.has(snapshotKey)) {
      continue
    }
    visitedSnapshots.add(snapshotKey)

    const snapshot = snapshots[snapshotKey]
    if (!snapshot) {
      continue
    }

    const parentLabel = createNodeLabel(current.name, current.version, current.importerPath)
    enqueueDependencies(queue, snapshot.dependencies, parentLabel)
    enqueueDependencies(queue, snapshot.optionalDependencies, parentLabel)
  }

  return new Map([...versions.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function formatRolldownVersionReport(projectRoot, versions) {
  const line = '='.repeat(78)
  const installedVersions = [...versions.keys()]
  const lines = [
    '',
    colorize(line, ANSI.dim, ANSI.cyan),
    colorize('[workspace] REAL ROLLDOWN VERSION CHECK', ANSI.bold, ANSI.cyan),
    colorize(line, ANSI.dim, ANSI.cyan),
    `${colorize('project:', ANSI.bold, ANSI.blue)} ${projectRoot}`,
  ]

  if (installedVersions.length === 0) {
    lines.push(`${colorize('result:', ANSI.bold, ANSI.yellow)} current lockfile uses ${colorize('0', ANSI.bold, ANSI.yellow)} rolldown versions`)
    lines.push(`${colorize('versions:', ANSI.bold, ANSI.magenta)} ${colorize('none', ANSI.bold, ANSI.yellow)}`)
    lines.push(colorize(line, ANSI.dim, ANSI.cyan))
    return lines.join('\n')
  }

  lines.push(
    `${colorize('result:', ANSI.bold, ANSI.green)} current lockfile uses ${colorize(String(installedVersions.length), ANSI.bold, ANSI.yellow)} rolldown version(s)`,
  )
  lines.push(
    `${colorize('versions:', ANSI.bold, ANSI.magenta)} ${installedVersions.map(version => colorize(version, ANSI.bold, ANSI.yellow)).join(colorize(', ', ANSI.dim))}`,
  )
  lines.push('')

  for (const version of installedVersions) {
    lines.push(`${colorize('- rolldown@', ANSI.bold, ANSI.green)}${colorize(version, ANSI.bold, ANSI.yellow)}`)
    for (const source of [...(versions.get(version) ?? [])].sort()) {
      lines.push(`  ${colorize('required by:', ANSI.bold, ANSI.blue)} ${colorize(source, ANSI.bold)}`)
    }
  }

  lines.push(colorize(line, ANSI.dim, ANSI.cyan))
  return lines.join('\n')
}

function readLockfile(projectRoot) {
  const lockfilePath = path.join(projectRoot, 'pnpm-lock.yaml')
  if (!existsSync(lockfilePath)) {
    throw new Error(`pnpm lockfile not found: ${lockfilePath}`)
  }
  return parse(readFileSync(lockfilePath, 'utf8'))
}

function readPackageJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`package.json not found: ${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function findWorkspaceRoot(from) {
  let current = path.resolve(from)
  while (true) {
    const lockfilePath = path.join(current, 'pnpm-workspace.yaml')
    const packageJsonPath = path.join(current, 'package.json')
    if (existsSync(lockfilePath) && existsSync(packageJsonPath)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  throw new Error(`workspace root not found from: ${from}`)
}

function verifyRolldownRequirePeer(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'packages/rolldown-require/package.json')
  const packageJson = readPackageJson(packageJsonPath)
  const actual = packageJson.peerDependencies?.rolldown
  if (actual !== EXPECTED_ROLLDOWN_REQUIRE_PEER) {
    throw new Error(
      [
        'packages/rolldown-require peerDependencies.rolldown is out of date',
        `expected: ${EXPECTED_ROLLDOWN_REQUIRE_PEER}`,
        `actual: ${String(actual)}`,
        `file: ${packageJsonPath}`,
      ].join('\n'),
    )
  }
}

function main() {
  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url))
    const projectRoot = findWorkspaceRoot(process.env.INIT_CWD || process.cwd() || scriptDir)
    verifyRolldownRequirePeer(projectRoot)
    const lockfile = readLockfile(projectRoot)
    const versions = collectRolldownVersions(lockfile)
    console.log(formatRolldownVersionReport(projectRoot, versions))
  }
  catch (error) {
    const line = '!'.repeat(78)
    const message = error instanceof Error ? error.stack || error.message : String(error)
    console.warn(
      `\n${colorize(line, ANSI.bold, ANSI.red)}\n${colorize('[workspace] failed to inspect rolldown versions', ANSI.bold, ANSI.red)}\n${colorize(message, ANSI.bold, ANSI.yellow)}\n${colorize(line, ANSI.bold, ANSI.red)}`,
    )
    process.exitCode = 1
  }
}

export {
  collectRolldownVersions,
  formatRolldownVersionReport,
  main,
  stripPeerSuffix,
  verifyRolldownRequirePeer,
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
