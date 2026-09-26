import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { resolveSmokeCache } from './createWeappViteSmoke/cache.mjs'
import { createScenario, createTarballCommand, installTarballRunner } from './createWeappViteSmoke/commands.mjs'
import { applyDependencyTarballs, describeDependencyTarballs, resolveDependencyTarballs, validateDependencyTarballScenarios } from './createWeappViteSmoke/dependencyTarballs.mjs'
import { timedRunCommand } from './createWeappViteSmoke/process.mjs'
import { classifyFailure, createPnpmProfileConfig, createRegistryEnvironment, REGISTRY_PROFILES, reportError, resolveRegistryProfiles, resolveRegistryVersion, versionLag } from './createWeappViteSmoke/registry.mjs'
import { runDevSmoke } from './createWeappViteSmoke/runtime.mjs'
import { assertPreparedProject, DEFAULT_TEMPLATE_NAMES, validateCreatedProjectStructure } from './createWeappViteSmoke/templates.mjs'

const INSTALL_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_INSTALL_TIMEOUT_MS || 10 * 60 * 1000)
const BUILD_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_BUILD_TIMEOUT_MS || 10 * 60 * 1000)
const captureUrl = new URL('./createWeappViteSmoke/capture.mjs', import.meta.url).href

function parseList(value, defaults) {
  return [...new Set((value?.split(',') ?? defaults).map(item => item.trim()).filter(Boolean))]
}

export async function readReceipt(receiptPath) {
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'))
  if (typeof receipt.version !== 'string' || typeof receipt.packageRoot !== 'string') {
    throw new TypeError('The scaffold process did not report its actual installed version')
  }
  return receipt
}

async function runScenario({ scenario, templateName, packageSpec, scenarioRoot, profile, env, tarballPackageRoot, dependencyTarballs, context }) {
  const projectName = `${scenario.name}-${templateName}`
  const label = `${profile.name}/${scenario.name}/${templateName}`
  const projectDir = path.join(scenarioRoot, projectName)
  await fs.mkdir(scenarioRoot, { recursive: true })
  const receiptPath = path.join(scenarioRoot, 'scaffold-receipt.json')
  const createCommand = tarballPackageRoot
    ? await createTarballCommand(tarballPackageRoot, projectName, templateName)
    : scenario.createCommand(projectName, templateName, packageSpec)
  const createMs = await timedRunCommand({
    ...createCommand,
    cwd: scenarioRoot,
    timeoutMs: INSTALL_TIMEOUT_MS,
    label: `${label} create`,
    env: {
      ...env,
      NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import=${captureUrl}`.trim(),
      CREATE_WEAPP_VITE_RECEIPT: receiptPath,
    },
  })
  const receipt = await readReceipt(receiptPath)
  context.actualCreateVersion = receipt.version
  context.stage = 'structure'
  await validateCreatedProjectStructure(projectDir, templateName, label, receipt.packageRoot)
  await applyDependencyTarballs(projectDir, dependencyTarballs)
  context.stage = 'install'
  const installMs = await timedRunCommand({
    ...scenario.installCommand(),
    cwd: projectDir,
    env,
    timeoutMs: INSTALL_TIMEOUT_MS,
    label: `${label} install`,
  })
  context.stage = 'prepare'
  await assertPreparedProject(projectDir)
  context.stage = 'build'
  const buildMs = await timedRunCommand({
    ...scenario.buildCommand(),
    cwd: projectDir,
    env,
    timeoutMs: BUILD_TIMEOUT_MS,
    label: `${label} build`,
  })
  context.stage = 'dev'
  const dev = await runDevSmoke(projectDir, `${label} dev`, scenario.devCommand(), templateName, env)
  return { createMs, installMs, buildMs, devReadyMs: dev.readyMs, devUpdateMs: dev.updateMs }
}

export function summarizeReport(report) {
  const productFailures = report.failures.filter(failure => failure.kind === 'product').length
  const networkFailures = report.failures.filter(failure => failure.kind === 'network').length
  const registryFailures = report.failures.filter(failure => failure.kind === 'registry-unavailable').length
  const laggingRegistries = [...new Set([
    ...report.registries.filter(registry => registry.lag === 'behind').map(registry => registry.name),
    ...[...(report.results ?? []), ...report.failures].filter(row => row.lag === 'behind').map(row => row.registryProfile),
  ])]
  const status = productFailures
    ? 'product-failure'
    : networkFailures
      ? 'environment-limited'
      : registryFailures
        ? 'registry-incomplete'
        : laggingRegistries.length ? 'passed-with-registry-lag' : 'passed'
  return { status, productFailures, networkFailures, registryFailures, laggingRegistries }
}

async function main() {
  const packageSpec = process.env.CREATE_WEAPP_VITE_SPEC?.trim() || 'latest'
  const templateNames = parseList(process.env.CREATE_WEAPP_VITE_TEMPLATES, DEFAULT_TEMPLATE_NAMES)
  for (const name of templateNames) {
    if (!DEFAULT_TEMPLATE_NAMES.includes(name)) {
      throw new Error(`Unknown template: ${name}`)
    }
  }
  const scenarios = parseList(process.env.CREATE_WEAPP_VITE_SCENARIOS, ['pnpm', 'yarn', 'npm']).map(name => createScenario(name))
  const dependencyTarballs = await resolveDependencyTarballs(process.env.CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS)
  validateDependencyTarballScenarios(dependencyTarballs, scenarios)
  const profiles = resolveRegistryProfiles(process.env.CREATE_WEAPP_VITE_REGISTRIES)
  if (!templateNames.length || !scenarios.length || !profiles.length) {
    throw new Error('Smoke matrix cannot be empty')
  }
  const tarball = process.env.CREATE_WEAPP_VITE_TARBALL ? path.resolve(process.env.CREATE_WEAPP_VITE_TARBALL) : undefined
  if (tarball) {
    const stat = await fs.stat(tarball)
    if (!stat.isFile() || !tarball.endsWith('.tgz')) {
      throw new Error('CREATE_WEAPP_VITE_TARBALL must point to a packed .tgz file')
    }
  }
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-smoke-'))
  const { cacheRoot, cacheMode } = resolveSmokeCache(tmpRoot, process.env.CREATE_WEAPP_VITE_CACHE_ROOT)
  const privateRoots = [...dependencyTarballs.flatMap(({ tarball }) => [tarball, tarball.replaceAll('\\', '/')]), cacheRoot, tmpRoot, os.homedir()]
  const report = {
    os: process.env.CREATE_WEAPP_VITE_REPORT_OS || process.platform,
    nodeVersion: process.env.CREATE_WEAPP_VITE_REPORT_NODE || process.version,
    runId: process.env.GITHUB_RUN_ID || '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '',
    packageSpec,
    artifact: tarball ? path.basename(tarball) : 'registry',
    ...describeDependencyTarballs(dependencyTarballs),
    cacheMode,
    expectedOfficialVersion: null,
    templates: templateNames,
    scenarios: scenarios.map(scenario => scenario.name),
    registries: [],
    results: [],
    failures: [],
  }
  const official = { name: 'npmjs', registry: REGISTRY_PROFILES.npmjs }
  const officialEnv = createRegistryEnvironment(official, path.join(tmpRoot, 'official-cache'))
  let officialError
  try {
    report.expectedOfficialVersion = await resolveRegistryVersion(official, packageSpec, tmpRoot, officialEnv)
  }
  catch (error) {
    officialError = error
    if (!profiles.some(profile => profile.name === 'npmjs')) {
      report.failures.push({ registryProfile: 'npmjs', stage: 'registry', kind: classifyFailure(error, { registryProfile: 'npmjs', stage: 'registry' }), error: reportError(error, privateRoots) })
    }
  }
  console.log(`Smoke ${packageSpec}; cache: ${cacheMode}; expected official version: ${report.expectedOfficialVersion ?? 'unavailable'}`)
  try {
    for (const profile of profiles) {
      const profileRoot = path.join(tmpRoot, profile.name)
      const profileCacheRoot = path.join(cacheRoot, profile.name)
      await fs.mkdir(profileRoot, { recursive: true })
      await fs.mkdir(profileCacheRoot, { recursive: true })
      const env = createRegistryEnvironment(profile, profileCacheRoot)
      const registryReport = { ...profile, resolvedVersion: null, actualVersions: [], expectedOfficialVersion: report.expectedOfficialVersion, lag: 'unknown' }
      report.registries.push(registryReport)
      try {
        if (profile.name === 'npmjs') {
          if (officialError) {
            throw officialError
          }
          registryReport.resolvedVersion = report.expectedOfficialVersion
        }
        else {
          registryReport.resolvedVersion = await resolveRegistryVersion(profile, packageSpec, profileRoot, env)
        }
        registryReport.lag = versionLag(registryReport.resolvedVersion, report.expectedOfficialVersion)
      }
      catch (error) {
        report.failures.push({ registryProfile: profile.name, stage: 'registry', kind: classifyFailure(error, { registryProfile: profile.name, stage: 'registry' }), error: reportError(error, privateRoots) })
        if (!tarball) {
          continue
        }
      }
      let tarballPackageRoot
      if (tarball) {
        try {
          tarballPackageRoot = await installTarballRunner(tarball, path.join(profileRoot, 'runner'), env, INSTALL_TIMEOUT_MS)
        }
        catch (error) {
          report.failures.push({ registryProfile: profile.name, stage: 'install', kind: classifyFailure(error, { registryProfile: profile.name, stage: 'install' }), error: reportError(error, privateRoots) })
          continue
        }
      }
      for (const { name } of scenarios) {
        const scenario = createScenario(name, createPnpmProfileConfig(profile, profileCacheRoot))
        for (const templateName of templateNames) {
          const context = { stage: 'create', actualCreateVersion: null }
          const metadata = { registryProfile: profile.name, registry: profile.registry, scenario: scenario.name, template: templateName, resolvedRegistryVersion: registryReport.resolvedVersion, expectedOfficialVersion: report.expectedOfficialVersion }
          try {
            const result = await runScenario({ scenario, templateName, packageSpec, profile, env, tarballPackageRoot, dependencyTarballs, context, scenarioRoot: path.join(profileRoot, `${scenario.name}-${templateName}`) })
            report.results.push({ ...metadata, ...result, actualCreateVersion: context.actualCreateVersion, lag: versionLag(context.actualCreateVersion, report.expectedOfficialVersion, Boolean(tarball)) })
            console.log(`[${profile.name}/${scenario.name}/${templateName}] OK (${context.actualCreateVersion})`)
          }
          catch (error) {
            const receiptFile = path.join(profileRoot, `${scenario.name}-${templateName}`, 'scaffold-receipt.json')
            const receipt = await readReceipt(receiptFile).catch(() => null)
            context.actualCreateVersion = receipt?.version ?? context.actualCreateVersion
            report.failures.push({ ...metadata, ...context, lag: versionLag(context.actualCreateVersion, report.expectedOfficialVersion, Boolean(tarball)), kind: classifyFailure(error, { registryProfile: profile.name, stage: context.stage }), error: reportError(error, privateRoots) })
            console.error(`[${profile.name}/${scenario.name}/${templateName}] ${context.stage} failed`)
          }
          if (context.actualCreateVersion && !registryReport.actualVersions.includes(context.actualCreateVersion)) {
            registryReport.actualVersions.push(context.actualCreateVersion)
          }
        }
      }
    }
  }
  finally {
    report.summary = summarizeReport(report)
    const reportFile = process.env.CREATE_WEAPP_VITE_REPORT_FILE
    if (reportFile) {
      await fs.mkdir(path.dirname(reportFile), { recursive: true })
      await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
    }
    await fs.rm(tmpRoot, { recursive: true, force: true })
  }
  console.log(JSON.stringify(report.summary, null, 2))
  for (const failure of report.failures) {
    console.error(`[${failure.registryProfile}/${failure.stage}/${failure.kind}] ${failure.error}`)
  }
  process.exitCode = report.summary.productFailures ? 1 : report.summary.networkFailures ? 2 : report.summary.registryFailures ? 3 : 0
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main()
}

export { createPnpmCommand, createPnpmInstallCommand } from './createWeappViteSmoke/commands.mjs'
export { changeAppTitle, waitForAppTitle } from './createWeappViteSmoke/runtime.mjs'
export { shouldSkipTemplateFile } from './createWeappViteSmoke/templates.mjs'
export { cleanupChildProcessHandles, waitForChildClose } from './project-lifecycle.mjs'
