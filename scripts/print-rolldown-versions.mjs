#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

import { parse } from 'yaml'

const DEFAULT_MODE = 'strict'
const PUBLISH_ROOTS = ['packages', '@weapp-core', 'mpcore/packages']
const TAR_NULL_SUFFIX_RE = /\0.*$/
const ROLLDOWN_RELATED_DEPENDENCIES = ['rolldown', 'rolldown-plugin-dts', 'rolldown-require']
const PACKAGE_JSON_ENTRY_NAME = 'package/package.json'
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

function isZeroBlock(buffer, offset) {
  for (let index = offset; index < offset + 512; index += 1) {
    if (buffer[index] !== 0) {
      return false
    }
  }
  return true
}

function readTarOctal(buffer, start, length) {
  const raw = buffer.subarray(start, start + length).toString('utf8').replace(TAR_NULL_SUFFIX_RE, '').trim()
  return raw ? Number.parseInt(raw, 8) : 0
}

function readTarString(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('utf8').replace(TAR_NULL_SUFFIX_RE, '')
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

function collectRolldownDependencyMatrix(
  projectRoot,
  {
    lockfile = readLockfile(projectRoot),
    readPackageJsonImpl = readPackageJson,
    targets = collectRolldownPublishTargets(projectRoot, readPackageJsonImpl),
    workspaceManifest = readWorkspaceManifest(projectRoot),
  } = {},
) {
  const rows = []
  const workspacePackagesByName = new Map(
    targets.map(target => [target.packageJson.name, target.packageJson]),
  )

  for (const target of targets) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const deps = target.packageJson[section]
      if (!deps) {
        continue
      }

      const spec = deps.rolldown
      if (typeof spec !== 'string') {
        continue
      }
      rows.push({
        dependencyName: 'rolldown',
        packageName: target.packageJson.name,
        resolvedSpec: resolveDependencySpecVersion(spec, 'rolldown', workspaceManifest),
        section,
        spec,
      })

      for (const dependencyName of ['rolldown-plugin-dts', 'rolldown-require']) {
        const dependencySpec = deps[dependencyName]
        if (typeof dependencySpec !== 'string') {
          continue
        }

        const resolvedPeerSpec = resolveRolldownPeerRequirement({
          dependencyName,
          lockfile,
          resolvedVersion: deps[dependencyName],
          spec: dependencySpec,
          workspaceManifest,
          workspacePackagesByName,
        })

        if (!resolvedPeerSpec) {
          continue
        }

        rows.push({
          dependencyName: 'rolldown',
          packageName: target.packageJson.name,
          resolvedSpec: resolvedPeerSpec,
          section,
          sourceDependencyName: dependencyName,
          spec: dependencySpec,
        })
      }
    }
  }

  return rows.sort((a, b) => {
    return a.packageName.localeCompare(b.packageName)
      || a.section.localeCompare(b.section)
      || (a.sourceDependencyName ?? '').localeCompare(b.sourceDependencyName ?? '')
      || a.dependencyName.localeCompare(b.dependencyName)
  })
}

function formatRolldownDependencyMatrix(rows) {
  if (rows.length === 0) {
    return ''
  }

  const lines = [
    colorize('[workspace] PACKAGE ROLLDOWN SPECS', ANSI.bold, ANSI.cyan),
  ]

  for (const row of rows) {
    const dependencyPath = row.sourceDependencyName
      ? `${row.section}.${row.sourceDependencyName} -> peerDependencies.${row.dependencyName}`
      : `${row.section}.${row.dependencyName}`
    lines.push(
      `${colorize(row.packageName, ANSI.bold, ANSI.blue)} ${colorize(dependencyPath, ANSI.bold, ANSI.magenta)} = ${colorize(row.resolvedSpec, ANSI.bold, ANSI.yellow)}`,
    )
  }

  return `${lines.join('\n')}\n`
}

function resolveLockfilePackageRolldownPeerVersion(lockfile, dependencyName, version) {
  const baseVersion = stripPeerSuffix(version)
  if (!baseVersion) {
    return null
  }
  return lockfile.packages?.[`${dependencyName}@${baseVersion}`]?.peerDependencies?.rolldown ?? null
}

function resolveWorkspacePackageRolldownPeerVersion(workspacePackage, workspaceManifest) {
  const peerSpec = workspacePackage?.peerDependencies?.rolldown
  if (typeof peerSpec !== 'string') {
    return null
  }
  return resolveDependencySpecVersion(peerSpec, 'rolldown', workspaceManifest)
}

function resolveRolldownPeerRequirement({
  dependencyName,
  lockfile,
  resolvedVersion,
  spec,
  workspaceManifest,
  workspacePackagesByName,
}) {
  if (spec.startsWith('workspace:') || String(resolvedVersion).startsWith('link:')) {
    return resolveWorkspacePackageRolldownPeerVersion(
      workspacePackagesByName.get(dependencyName),
      workspaceManifest,
    )
  }

  return resolveLockfilePackageRolldownPeerVersion(lockfile, dependencyName, resolvedVersion)
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

function readPackedPackageJsonFromTarball(tarballPath) {
  const archive = gunzipSync(readFileSync(tarballPath))

  for (let offset = 0; offset < archive.length; offset += 512) {
    if (isZeroBlock(archive, offset)) {
      break
    }

    const name = readTarString(archive, offset, 100)
    const prefix = readTarString(archive, offset + 345, 155)
    const entryName = prefix ? `${prefix}/${name}` : name
    const size = readTarOctal(archive, offset + 124, 12)
    const dataStart = offset + 512
    const dataEnd = dataStart + size

    if (entryName === PACKAGE_JSON_ENTRY_NAME) {
      return JSON.parse(archive.subarray(dataStart, dataEnd).toString('utf8'))
    }

    offset = dataStart + Math.ceil(size / 512) * 512 - 512
  }

  throw new Error(`packed package.json not found in tarball: ${tarballPath}`)
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

function resolveWorkspacePackageSpecVersion(spec, dependencyName, workspaceManifest, workspaceVersionsByName) {
  if (typeof spec !== 'string' || spec.length === 0) {
    return spec
  }

  if (spec === 'catalog:') {
    return resolveCatalogDependencyVersion(workspaceManifest, dependencyName)
  }

  if (!spec.startsWith('workspace:')) {
    return spec
  }

  const workspaceVersion = workspaceVersionsByName.get(dependencyName)
  if (!workspaceVersion) {
    return spec
  }

  const range = spec.slice('workspace:'.length)
  if (!range || range === '*') {
    return workspaceVersion
  }
  if (range === '^' || range === '~') {
    return `${range}${workspaceVersion}`
  }
  return range
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

function collectWorkspacePackageJsonPaths(projectRoot) {
  const packageJsonPaths = []
  const ignoredDirNames = new Set(['node_modules', 'dist', '.git', '.turbo'])

  function walk(currentDir) {
    if (!existsSync(currentDir)) {
      return
    }

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) {
          continue
        }
        walk(path.join(currentDir, entry.name))
        continue
      }
      if (entry.isFile() && entry.name === 'package.json') {
        packageJsonPaths.push(path.join(currentDir, entry.name))
      }
    }
  }

  for (const root of PUBLISH_ROOTS) {
    walk(path.join(projectRoot, root))
  }

  return packageJsonPaths.sort((a, b) => a.localeCompare(b))
}

function collectWorkspacePackageVersions(projectRoot, readPackageJsonImpl = readPackageJson) {
  const versionsByName = new Map()

  for (const filePath of collectWorkspacePackageJsonPaths(projectRoot)) {
    const packageJson = readPackageJsonImpl(filePath)
    if (packageJson.private === true || typeof packageJson.name !== 'string' || typeof packageJson.version !== 'string') {
      continue
    }
    versionsByName.set(packageJson.name, packageJson.version)
  }

  return versionsByName
}

function collectRolldownPublishTargets(projectRoot, readPackageJsonImpl = readPackageJson) {
  const targets = []

  for (const filePath of collectWorkspacePackageJsonPaths(projectRoot)) {
    const packageJson = readPackageJsonImpl(filePath)
    if (packageJson.private === true || typeof packageJson.name !== 'string') {
      continue
    }

    const sections = ['dependencies', 'peerDependencies', 'optionalDependencies']
    const hasRelatedDependency = sections.some(section =>
      ROLLDOWN_RELATED_DEPENDENCIES.some(name => typeof packageJson[section]?.[name] === 'string'),
    )

    if (!hasRelatedDependency) {
      continue
    }

    targets.push({
      filePath,
      packageJson,
      packageRoot: path.dirname(filePath),
    })
  }

  return targets
}

function collectRolldownExpectedPublishedSpecs(packageJson, workspaceManifest, workspaceVersionsByName) {
  const expectedSpecs = []

  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = packageJson[section]
    if (!deps) {
      continue
    }

    for (const dependencyName of ROLLDOWN_RELATED_DEPENDENCIES) {
      const spec = deps[dependencyName]
      if (typeof spec !== 'string') {
        continue
      }
      expectedSpecs.push({
        dependencyName,
        expected: resolveWorkspacePackageSpecVersion(spec, dependencyName, workspaceManifest, workspaceVersionsByName),
        section,
      })
    }
  }

  return expectedSpecs
}

function resolvePnpmCommand({
  execPath = process.execPath,
  npmExecpath = process.env.npm_execpath,
  platform = process.platform,
} = {}) {
  if (typeof npmExecpath === 'string' && npmExecpath.length > 0) {
    return {
      args: [npmExecpath],
      command: execPath,
      shell: false,
    }
  }

  return {
    args: [],
    command: 'pnpm',
    shell: platform === 'win32',
  }
}

function packWorkspacePackageJson(
  packageRoot,
  {
    execFileSyncImpl = execFileSync,
    mkdtempSyncImpl = mkdtempSync,
    readPackedPackageJsonImpl = readPackedPackageJsonFromTarball,
    rmSyncImpl = rmSync,
  } = {},
) {
  const packDir = mkdtempSyncImpl(path.join(os.tmpdir(), 'rolldown-pack-'))
  try {
    const pnpmCommand = resolvePnpmCommand()
    const stdout = execFileSyncImpl(
      pnpmCommand.command,
      [...pnpmCommand.args, '--dir', packageRoot, 'pack', '--pack-destination', packDir, '--json'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        shell: pnpmCommand.shell,
      },
    )
    const parsed = JSON.parse(stdout)
    const tarballPath = Array.isArray(parsed) ? parsed[0]?.filename : parsed?.filename
    if (typeof tarballPath !== 'string' || tarballPath.length === 0) {
      throw new Error(`pnpm pack did not return a tarball filename for ${packageRoot}`)
    }
    return readPackedPackageJsonImpl(tarballPath)
  }
  finally {
    rmSyncImpl(packDir, { force: true, recursive: true })
  }
}

function collectRolldownPublishArtifactIssues(
  projectRoot,
  {
    packWorkspacePackageJsonImpl = packWorkspacePackageJson,
    readPackageJsonImpl = readPackageJson,
    targets = collectRolldownPublishTargets(projectRoot, readPackageJsonImpl),
    workspaceManifest = readWorkspaceManifest(projectRoot),
    workspaceVersionsByName = collectWorkspacePackageVersions(projectRoot, readPackageJsonImpl),
  } = {},
) {
  const issues = []

  for (const target of targets) {
    const packedPackageJson = packWorkspacePackageJsonImpl(target.packageRoot)
    const expectedSpecs = collectRolldownExpectedPublishedSpecs(
      target.packageJson,
      workspaceManifest,
      workspaceVersionsByName,
    )

    for (const item of expectedSpecs) {
      const actual = packedPackageJson[item.section]?.[item.dependencyName]
      if (actual !== item.expected) {
        issues.push(
          [
            `${target.packageJson.name} packed manifest mismatch`,
            `section: ${item.section}`,
            `dependency: ${item.dependencyName}`,
            `expected: ${item.expected}`,
            `actual: ${String(actual)}`,
            `file: ${target.filePath}`,
          ].join('\n'),
        )
      }
    }
  }

  return issues
}

function verifyRolldownPublishArtifacts(projectRoot, options = {}) {
  const issues = collectRolldownPublishArtifactIssues(projectRoot, options)
  if (issues.length > 0) {
    throw new Error(
      [
        'rolldown-related packed manifests are out of date',
        ...issues,
      ].join('\n\n'),
    )
  }
}

function formatRolldownWarningReport(projectRoot, versions, extraWarnings = []) {
  const lines = [
    colorize('[workspace] rolldown warning', ANSI.bold, ANSI.yellow),
    `project: ${projectRoot}`,
  ]

  if (versions.size > 1) {
    lines.push(
      `multiple rolldown versions detected: ${[...versions.keys()].join(', ')}`,
    )
  }

  lines.push(...extraWarnings)
  return lines.join('\n')
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
    const dependencyMatrix = collectRolldownDependencyMatrix(projectRoot)
    console.log(`${formatRolldownVersionReport(projectRoot, versions)}\n${formatRolldownDependencyMatrix(dependencyMatrix)}`.trimEnd())
    if (mode === 'report') {
      return
    }
    if (mode === 'warn') {
      const warnings = []
      if (versions.size > 1) {
        warnings.push('install completed with multiple rolldown versions in pnpm-lock.yaml')
      }
      if (warnings.length > 0) {
        console.warn(`\n${formatRolldownWarningReport(projectRoot, versions, warnings)}\n`)
      }
      return
    }
    verifyRolldownCatalogReferences(projectRoot)
    verifyRolldownRequirePeer(projectRoot, workspaceManifest)
    verifySingleRolldownVersion(versions)
    verifyRolldownPublishArtifacts(projectRoot, { workspaceManifest })
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
  collectRolldownDependencyMatrix,
  collectRolldownExpectedPublishedSpecs,
  collectRolldownPublishArtifactIssues,
  collectRolldownPublishTargets,
  collectRolldownVersions,
  collectViteRolldownVersions,
  collectWorkspacePackageVersions,
  formatRolldownDependencyMatrix,
  formatRolldownVersionReport,
  formatRolldownWarningReport,
  main,
  packWorkspacePackageJson,
  readPackedPackageJsonFromTarball,
  readWorkspaceManifest,
  resolveAnsiEnabled,
  resolveCatalogDependencyVersion,
  resolveDependencySpecVersion,
  resolveMode,
  resolvePnpmCommand,
  resolveWorkspacePackageSpecVersion,
  stripPeerSuffix,
  syncRolldownCatalogReferences,
  verifyRolldownCatalogReferences,
  verifyRolldownPublishArtifacts,
  verifyRolldownRequirePeer,
  verifySingleRolldownVersion,
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
