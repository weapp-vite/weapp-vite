#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

const DEFAULT_MODE = 'strict'
let ansiEnabled = true
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
  if (!ansiEnabled) {
    return text
  }
  return `${codes.join('')}${text}${ANSI.reset}`
}

function resolveAnsiEnabled(env = process.env, stdout = process.stdout) {
  const forceColor = env.FORCE_COLOR
  if (forceColor === '0') {
    return false
  }
  if (typeof forceColor === 'string' && forceColor.length > 0) {
    return true
  }
  if ('NO_COLOR' in env) {
    return false
  }
  if (env.CI === 'true' || env.CI === '1') {
    return false
  }
  if (typeof stdout?.isTTY === 'boolean') {
    return true
  }
  return true
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
  const summaryLine = installedVersions.length > 0
    ? `ROLLDOWN_SUMMARY latest=${installedVersions[0]} total=${installedVersions.length} all=${installedVersions.join(',')}`
    : 'ROLLDOWN_SUMMARY latest=none total=0 all=none'
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

  lines.push('')
  lines.push(summaryLine)
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

function readWorkspaceManifest(projectRoot) {
  const workspacePath = path.join(projectRoot, 'pnpm-workspace.yaml')
  if (!existsSync(workspacePath)) {
    throw new Error(`pnpm workspace manifest not found: ${workspacePath}`)
  }
  return parse(readFileSync(workspacePath, 'utf8'))
}

function collectViteRolldownVersions(lockfile) {
  const snapshots = lockfile.snapshots ?? {}
  const versions = new Map()

  for (const [snapshotKey, snapshot] of Object.entries(snapshots)) {
    if (!snapshotKey.startsWith('vite@')) {
      continue
    }
    const version = snapshot.dependencies?.rolldown
    if (typeof version !== 'string' || isExternalReference(version)) {
      continue
    }
    const resolvedVersion = stripPeerSuffix(version)
    const requiredBy = versions.get(resolvedVersion) ?? new Set()
    requiredBy.add(snapshotKey)
    versions.set(resolvedVersion, requiredBy)
  }

  return new Map([...versions.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function resolveCatalogDependencyVersion(workspaceManifest, dependencyName) {
  const version = workspaceManifest?.catalog?.[dependencyName]
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(
      [
        `failed to resolve ${dependencyName} version from pnpm-workspace.yaml catalog`,
        `expected catalog.${dependencyName} to be a non-empty string`,
      ].join('\n'),
    )
  }

  return version
}

function readPackageJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`package.json not found: ${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function writePackageJson(filePath, packageJson) {
  writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`)
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

function resolveDependencySpecVersion(spec, dependencyName, workspaceManifest) {
  if (spec === 'catalog:') {
    return resolveCatalogDependencyVersion(workspaceManifest, dependencyName)
  }
  return spec
}

function getManagedRolldownCatalogReferences(projectRoot) {
  return [
    {
      expected: 'catalog:',
      filePath: path.join(projectRoot, 'packages/weapp-vite/package.json'),
      section: 'dependencies',
    },
    {
      expected: 'catalog:',
      filePath: path.join(projectRoot, 'packages/rolldown-require/package.json'),
      section: 'peerDependencies',
    },
  ]
}

function verifyRolldownCatalogReferences(projectRoot, readPackageJsonImpl = readPackageJson) {
  const checks = getManagedRolldownCatalogReferences(projectRoot)

  for (const check of checks) {
    const packageJson = readPackageJsonImpl(check.filePath)
    const actual = packageJson[check.section]?.rolldown
    if (actual !== check.expected) {
      throw new Error(
        [
          `${check.filePath} ${check.section}.rolldown must reference workspace catalog`,
          `expected: ${check.expected}`,
          `actual: ${String(actual)}`,
        ].join('\n'),
      )
    }
  }
}

function syncRolldownCatalogReferences(
  projectRoot,
  {
    readPackageJsonImpl = readPackageJson,
    writePackageJsonImpl = writePackageJson,
  } = {},
) {
  const changedFiles = []

  for (const check of getManagedRolldownCatalogReferences(projectRoot)) {
    const packageJson = readPackageJsonImpl(check.filePath)
    const section = packageJson[check.section] ?? {}

    if (section.rolldown === check.expected) {
      continue
    }

    packageJson[check.section] = {
      ...section,
      rolldown: check.expected,
    }
    writePackageJsonImpl(check.filePath, packageJson)
    changedFiles.push(check.filePath)
  }

  return changedFiles
}

function verifyRolldownRequirePeer(projectRoot, workspaceManifest = readWorkspaceManifest(projectRoot)) {
  const packageJsonPath = path.join(projectRoot, 'packages/rolldown-require/package.json')
  const packageJson = readPackageJson(packageJsonPath)
  const expected = resolveCatalogDependencyVersion(workspaceManifest, 'rolldown')
  const actual = resolveDependencySpecVersion(packageJson.peerDependencies?.rolldown, 'rolldown', workspaceManifest)
  if (actual !== expected) {
    throw new Error(
      [
        'packages/rolldown-require peerDependencies.rolldown is out of date',
        `expected: ${expected}`,
        `actual: ${String(actual)}`,
        `file: ${packageJsonPath}`,
      ].join('\n'),
    )
  }
}

function verifySingleRolldownVersion(versions) {
  if (versions.size > 1) {
    const installedVersions = [...versions.keys()]
    throw new Error(
      [
        'multiple rolldown versions detected in pnpm-lock.yaml',
        `versions: ${installedVersions.join(', ')}`,
        'release is blocked until rolldown versions are unified',
      ].join('\n'),
    )
  }
}

function resolveMode(argv = process.argv.slice(2)) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--mode' && typeof argv[index + 1] === 'string') {
      return argv[index + 1]
    }
    if (arg.startsWith('--mode=')) {
      return arg.slice('--mode='.length)
    }
  }
  return DEFAULT_MODE
}

function main(options = {}) {
  try {
    ansiEnabled = options.ansiEnabled ?? resolveAnsiEnabled()
    const mode = options.mode ?? resolveMode()
    const scriptDir = path.dirname(fileURLToPath(import.meta.url))
    const projectRoot = findWorkspaceRoot(process.env.INIT_CWD || process.cwd() || scriptDir)
    if (mode === 'sync') {
      const changedFiles = syncRolldownCatalogReferences(projectRoot)
      if (changedFiles.length > 0) {
        console.log(
          [
            '[workspace] synced rolldown catalog references',
            ...changedFiles.map(filePath => `- ${path.relative(projectRoot, filePath)}`),
          ].join('\n'),
        )
      }
      return
    }
    const lockfile = readLockfile(projectRoot)
    const workspaceManifest = readWorkspaceManifest(projectRoot)
    const versions = collectRolldownVersions(lockfile)
    console.log(formatRolldownVersionReport(projectRoot, versions))
    if (mode === 'report') {
      return
    }
    verifyRolldownCatalogReferences(projectRoot)
    verifyRolldownRequirePeer(projectRoot, workspaceManifest)
    verifySingleRolldownVersion(versions)
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
  collectViteRolldownVersions,
  formatRolldownVersionReport,
  main,
  readWorkspaceManifest,
  resolveAnsiEnabled,
  resolveCatalogDependencyVersion,
  resolveDependencySpecVersion,
  resolveMode,
  stripPeerSuffix,
  syncRolldownCatalogReferences,
  verifyRolldownCatalogReferences,
  verifyRolldownRequirePeer,
  verifySingleRolldownVersion,
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
