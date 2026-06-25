import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const workspaceRoots = [
  '@weapp-core',
  'packages',
  'packages-runtime',
  'benchmarks',
  'packages-private',
  'mpcore/packages',
  'extensions',
]

const excludedPackages = new Set([
  '@weapp-vite/sfc-playground',
])

function readPackageJson(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return null
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf8'))
}

function discoverPackageDirs() {
  const packageDirs = []

  for (const workspaceRoot of workspaceRoots) {
    const absoluteRoot = path.join(repoRoot, workspaceRoot)
    if (!existsSync(absoluteRoot)) {
      continue
    }

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      packageDirs.push(path.join(absoluteRoot, entry.name))
    }
  }

  return packageDirs
}

function getWorkspaceDependencies(packageJson) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  }

  return Object.entries(dependencies)
    .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'))
    .map(([name]) => name)
}

function createBuildPlan() {
  const packages = new Map()

  for (const packageDir of discoverPackageDirs()) {
    const packageJson = readPackageJson(packageDir)
    if (!packageJson?.name || excludedPackages.has(packageJson.name) || !packageJson.scripts?.build) {
      continue
    }

    packages.set(packageJson.name, {
      dir: packageDir,
      name: packageJson.name,
      workspaceDependencies: getWorkspaceDependencies(packageJson),
    })
  }

  const visiting = new Set()
  const visited = new Set()
  const plan = []

  function visit(packageName) {
    if (visited.has(packageName)) {
      return
    }
    if (visiting.has(packageName)) {
      throw new Error(`Circular workspace build dependency detected at ${packageName}`)
    }

    const packageInfo = packages.get(packageName)
    if (!packageInfo) {
      return
    }

    visiting.add(packageName)
    for (const dependencyName of packageInfo.workspaceDependencies) {
      visit(dependencyName)
    }
    visiting.delete(packageName)
    visited.add(packageName)
    plan.push(packageInfo)
  }

  for (const packageName of packages.keys()) {
    visit(packageName)
  }

  return plan
}

function createPnpmInvocation() {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && existsSync(npmExecPath) && /\.(?:cjs|mjs|js)$/i.test(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath],
    }
  }

  if (process.platform === 'win32' && process.env.PNPM_HOME) {
    const pnpmEntrypoint = path.resolve(process.env.PNPM_HOME, '..', 'pnpm', 'bin', 'pnpm.cjs')
    if (existsSync(pnpmEntrypoint)) {
      return {
        command: process.execPath,
        args: [pnpmEntrypoint],
      }
    }
  }

  return {
    command: 'pnpm',
    args: [],
  }
}

const pnpmInvocation = createPnpmInvocation()
const buildPlan = createBuildPlan()

console.log(`Windows CI core build plan: ${buildPlan.length} packages`)

for (const [index, packageInfo] of buildPlan.entries()) {
  const label = `[${index + 1}/${buildPlan.length}] ${packageInfo.name}`
  console.log(`\n${label}`)

  const result = spawnSync(pnpmInvocation.command, [...pnpmInvocation.args, '--filter', packageInfo.name, 'build'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
