import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CREATE_PACKAGE_NAME = 'weapp-vite'
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_PACKAGE_SPEC = process.env.CREATE_WEAPP_VITE_SPEC?.trim() || 'latest'
const DEFAULT_TEMPLATE_NAMES = ['default', 'lib', 'wevu', 'wevu-tdesign', 'tailwindcss', 'vant', 'tdesign']
const TEMPLATE_NAMES = (process.env.CREATE_WEAPP_VITE_TEMPLATES?.split(',') ?? DEFAULT_TEMPLATE_NAMES)
  .map(name => name.trim())
  .filter(Boolean)
const DEFAULT_SCENARIO_NAMES = ['pnpm', 'yarn', 'npm', 'bun']
const ENABLED_SCENARIO_NAMES = new Set(
  (process.env.CREATE_WEAPP_VITE_SCENARIOS?.split(',') ?? DEFAULT_SCENARIO_NAMES)
    .map(name => name.trim())
    .filter(Boolean),
)
const INSTALL_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_INSTALL_TIMEOUT_MS || 10 * 60 * 1000)
const BUILD_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_BUILD_TIMEOUT_MS || 10 * 60 * 1000)
const DEV_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_DEV_TIMEOUT_MS || 3 * 60 * 1000)
const DEV_SETTLE_MS = Number(process.env.CREATE_WEAPP_VITE_DEV_SETTLE_MS || 3 * 1000)
const UPDATE_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_UPDATE_TIMEOUT_MS || 60 * 1000)
const REPORT_FILE = process.env.CREATE_WEAPP_VITE_REPORT_FILE?.trim()
const REPORT_META = {
  os: process.env.CREATE_WEAPP_VITE_REPORT_OS?.trim() || process.platform,
  nodeVersion: process.env.CREATE_WEAPP_VITE_REPORT_NODE?.trim() || process.version,
  runId: process.env.GITHUB_RUN_ID?.trim() || '',
  runAttempt: process.env.GITHUB_RUN_ATTEMPT?.trim() || '',
}
const NEWLINE_RE = /\r?\n/
const TEMPLATE_DIR_MAP = {
  'default': 'weapp-vite-template',
  'lib': 'weapp-vite-lib-template',
  'wevu': 'weapp-vite-wevu-template',
  'wevu-tdesign': 'weapp-vite-wevu-tailwindcss-tdesign-template',
  'tailwindcss': 'weapp-vite-tailwindcss-template',
  'tdesign': 'weapp-vite-tailwindcss-tdesign-template',
  'vant': 'weapp-vite-tailwindcss-vant-template',
}

function getExecutableName(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command
}

function createChildProcess(command, args, options) {
  if (process.platform === 'win32') {
    return spawn(formatCommand(getExecutableName(command), args), {
      ...options,
      shell: true,
    })
  }

  return spawn(getExecutableName(command), args, options)
}

function isFilePresent(file) {
  return fs.access(file).then(() => true).catch(() => false)
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join('/')
}

function resolveWorkspaceTemplateDir(templateName) {
  const templateDirName = TEMPLATE_DIR_MAP[templateName] || templateName
  return path.resolve(MODULE_DIR, '../templates', templateDirName)
}

async function resolveExpectedTemplateDir(templateName) {
  const packagedTemplateDir = path.resolve(MODULE_DIR, '../packages/create-weapp-vite/templates', templateName)
  if (await isFilePresent(packagedTemplateDir)) {
    return packagedTemplateDir
  }
  return resolveWorkspaceTemplateDir(templateName)
}

function shouldSkipTemplateFile(filePath) {
  return (
    filePath.includes('node_modules')
    || filePath.includes(`${path.sep}.weapp-vite${path.sep}`)
    || filePath.includes('vite.config.ts.timestamp')
    || filePath.includes(`${path.sep}dist${path.sep}`)
    || filePath.endsWith(`${path.sep}CHANGELOG.md`)
    || filePath.includes(`${path.sep}.turbo${path.sep}`)
    || filePath.endsWith(`${path.sep}.DS_Store`)
  )
}

function normalizeExpectedProjectPath(relativePath) {
  if (relativePath === 'gitignore') {
    return '.gitignore'
  }
  return relativePath
}

async function collectProjectFiles(rootDir) {
  const files = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      const relativePath = normalizeRelativePath(path.relative(rootDir, fullPath))
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      files.push(relativePath)
    }
  }

  if (await isFilePresent(rootDir)) {
    await walk(rootDir)
  }

  return files.sort((a, b) => a.localeCompare(b))
}

async function collectExpectedTemplateFiles(templateName) {
  const templateDir = await resolveExpectedTemplateDir(templateName)
  const files = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (shouldSkipTemplateFile(fullPath)) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      const relativePath = normalizeRelativePath(path.relative(templateDir, fullPath))
      files.push(normalizeExpectedProjectPath(relativePath))
    }
  }

  await walk(templateDir)

  return files.sort((a, b) => a.localeCompare(b))
}

function formatMissingFiles(files, limit = 20) {
  if (files.length === 0) {
    return ''
  }

  const visible = files.slice(0, limit).map(file => `- ${file}`).join('\n')
  const remaining = files.length - Math.min(files.length, limit)
  return remaining > 0
    ? `${visible}\n- ... and ${remaining} more`
    : visible
}

async function validateCreatedProjectStructure(projectDir, templateName, label) {
  const [expectedFiles, actualFiles] = await Promise.all([
    collectExpectedTemplateFiles(templateName),
    collectProjectFiles(projectDir),
  ])
  const actualFileSet = new Set(actualFiles)
  const missingFiles = expectedFiles.filter(file => !actualFileSet.has(file))

  if (missingFiles.length > 0) {
    throw new Error(
      [
        `[${label}] Generated project is missing ${missingFiles.length} expected file(s) for template "${templateName}"`,
        `expected files: ${expectedFiles.length}`,
        `actual files: ${actualFiles.length}`,
        'missing files:',
        formatMissingFiles(missingFiles),
      ].join('\n'),
    )
  }
}

function getCreatePackageSpecifier(packageManager, packageSpec) {
  if (!packageSpec || packageSpec === 'latest') {
    return packageManager === 'yarn'
      ? CREATE_PACKAGE_NAME
      : `${CREATE_PACKAGE_NAME}@latest`
  }
  return `${CREATE_PACKAGE_NAME}@${packageSpec}`
}

const SCENARIOS = [
  {
    name: 'pnpm',
    createCommand(projectName, templateName, packageSpec) {
      return {
        command: 'pnpm',
        args: ['create', getCreatePackageSpecifier('pnpm', packageSpec), projectName, templateName],
      }
    },
    installCommand() {
      return {
        command: 'pnpm',
        args: ['install'],
      }
    },
    buildCommand() {
      return {
        command: 'pnpm',
        args: ['build'],
      }
    },
    devCommand() {
      return {
        command: 'pnpm',
        args: ['dev'],
      }
    },
  },
  {
    name: 'yarn',
    createCommand(projectName, templateName, packageSpec) {
      return {
        command: 'yarn',
        args: ['create', getCreatePackageSpecifier('yarn', packageSpec), projectName, templateName],
      }
    },
    installCommand() {
      return {
        command: 'yarn',
        args: ['install'],
      }
    },
    buildCommand() {
      return {
        command: 'pnpm',
        args: ['build'],
      }
    },
    devCommand() {
      return {
        command: 'pnpm',
        args: ['dev'],
      }
    },
  },
  {
    name: 'npm',
    createCommand(projectName, templateName, packageSpec) {
      return {
        command: 'npm',
        args: ['create', getCreatePackageSpecifier('npm', packageSpec), projectName, templateName],
      }
    },
    installCommand() {
      return {
        command: 'npm',
        args: ['install'],
      }
    },
    buildCommand() {
      return {
        command: 'pnpm',
        args: ['build'],
      }
    },
    devCommand() {
      return {
        command: 'pnpm',
        args: ['dev'],
      }
    },
  },
  {
    name: 'bun',
    createCommand(projectName, templateName, packageSpec) {
      return {
        command: 'bun',
        args: ['create', getCreatePackageSpecifier('bun', packageSpec), projectName, templateName],
      }
    },
    installCommand() {
      return {
        command: 'bun',
        args: ['install'],
      }
    },
    buildCommand() {
      return {
        command: 'bun',
        args: ['run', 'build'],
      }
    },
    devCommand() {
      return {
        command: 'bun',
        args: ['run', 'dev'],
      }
    },
  },
].filter(scenario => ENABLED_SCENARIO_NAMES.has(scenario.name))

function formatCommand(command, args) {
  return [command, ...args].join(' ')
}

function tail(text, maxLines = 80) {
  const lines = text.trim().split(NEWLINE_RE).filter(Boolean)
  return lines.slice(-maxLines).join('\n')
}

async function runCommand({ cwd, command, args, timeoutMs, label }) {
  const stdoutChunks = []
  const stderrChunks = []
  const printableCommand = formatCommand(command, args)

  console.log(`\n[${label}] ${printableCommand}`)

  return await new Promise((resolve, reject) => {
    const child = createChildProcess(command, args, {
      cwd,
      env: {
        ...process.env,
        CI: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timer = setTimeout(async () => {
      await terminateProcess(child)
      reject(new Error(`[${label}] Timed out after ${timeoutMs}ms\n${printableCommand}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdoutChunks.push(text)
      process.stdout.write(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      process.stderr.write(text)
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({
          stdout: stdoutChunks.join(''),
          stderr: stderrChunks.join(''),
        })
        return
      }

      const stdout = tail(stdoutChunks.join(''))
      const stderr = tail(stderrChunks.join(''))
      reject(new Error(
        [
          `[${label}] Command failed with code ${code ?? 'null'} signal ${signal ?? 'null'}`,
          printableCommand,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
        ].filter(Boolean).join('\n\n'),
      ))
    })
  })
}

async function timedRunCommand(input) {
  const startedAt = Date.now()
  await runCommand(input)
  return Date.now() - startedAt
}

async function terminateProcess(child) {
  if (!child.pid || child.killed || child.exitCode !== null) {
    return
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      })
      killer.on('close', resolve)
      killer.on('error', resolve)
    })
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  }
  catch {
    child.kill('SIGTERM')
  }
  const start = Date.now()
  while (child.exitCode === null && Date.now() - start < 10_000) {
    await delay(200)
  }
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    }
    catch {
      child.kill('SIGKILL')
    }
  }
}

async function waitForChildClose(child, timeoutMs = 10_000) {
  if (child.exitCode !== null) {
    return
  }

  await Promise.race([
    new Promise((resolve) => {
      child.once('close', resolve)
      child.once('error', resolve)
    }),
    delay(timeoutMs),
  ])
}

async function distHasRequiredOutputs(projectDir) {
  const requiredFiles = [
    path.join(projectDir, 'dist/app.json'),
    path.join(projectDir, 'dist/app.js'),
  ]
  const checks = await Promise.all(requiredFiles.map(isFilePresent))
  return checks.every(Boolean)
}

async function findExistingFile(paths) {
  for (const file of paths) {
    try {
      await fs.access(file)
      return file
    }
    catch {
      continue
    }
  }
  return null
}

async function waitForFileChange(file, previousMtimeMs, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const stat = await fs.stat(file)
      if (stat.mtimeMs > previousMtimeMs) {
        return Date.now() - startedAt
      }
    }
    catch {
      // noop
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for file update: ${file}`)
}

async function measureDevUpdate(projectDir, label) {
  const sourceFile = await findExistingFile([
    path.join(projectDir, 'src/app.json'),
    path.join(projectDir, 'src/app.ts'),
    path.join(projectDir, 'src/app.js'),
    path.join(projectDir, 'src/app.vue'),
  ])
  const distFile = await findExistingFile([
    path.join(projectDir, 'dist/app.json'),
    path.join(projectDir, 'dist/app.js'),
  ])

  if (!sourceFile || !distFile) {
    throw new Error(`[${label}] Missing source/dist file for dev update measurement`)
  }

  const original = await fs.readFile(sourceFile, 'utf8')
  const marker = `\n/* create-weapp-vite-smoke:${Date.now()} */\n`
  const previousMtimeMs = (await fs.stat(distFile)).mtimeMs

  try {
    await fs.writeFile(sourceFile, `${original}${marker}`, 'utf8')
    return await waitForFileChange(distFile, previousMtimeMs, UPDATE_TIMEOUT_MS)
  }
  finally {
    await fs.writeFile(sourceFile, original, 'utf8')
  }
}

async function runDevSmoke(projectDir, label, devCommand) {
  await fs.rm(path.join(projectDir, 'dist'), { recursive: true, force: true })

  console.log(`\n[${label}] ${formatCommand(devCommand.command, devCommand.args)}`)

  const stdoutChunks = []
  const stderrChunks = []
  const child = createChildProcess(devCommand.command, devCommand.args, {
    cwd: projectDir,
    env: {
      ...process.env,
      CI: 'true',
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    stdoutChunks.push(text)
    process.stdout.write(text)
  })

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderrChunks.push(text)
    process.stderr.write(text)
  })

  const start = Date.now()
  try {
    while (true) {
      if (child.exitCode !== null) {
        throw new Error(
          [
            `[${label}] dev command exited before outputs were ready with code ${child.exitCode}`,
            tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
            tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
          ].filter(Boolean).join('\n\n'),
        )
      }

      if (await distHasRequiredOutputs(projectDir)) {
        const readyMs = Date.now() - start
        await delay(DEV_SETTLE_MS)
        if (child.exitCode !== null) {
          throw new Error(
            [
              `[${label}] dev command exited during settle window with code ${child.exitCode}`,
              tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
              tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
            ].filter(Boolean).join('\n\n'),
          )
        }
        const updateMs = await measureDevUpdate(projectDir, label)
        return {
          readyMs,
          updateMs,
        }
      }

      if (Date.now() - start > DEV_TIMEOUT_MS) {
        throw new Error(
          [
            `[${label}] Timed out waiting for dev outputs after ${DEV_TIMEOUT_MS}ms`,
            tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
            tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
          ].filter(Boolean).join('\n\n'),
        )
      }

      await delay(1000)
    }
  }
  finally {
    await terminateProcess(child)
    await waitForChildClose(child)
  }
}

async function runScenario({ scenario, templateName, packageSpec, scenarioRoot }) {
  const projectName = `${scenario.name}-${templateName}`
  const labelPrefix = `${scenario.name}/${templateName}`
  const createCommand = scenario.createCommand(projectName, templateName, packageSpec)
  const installCommand = scenario.installCommand(projectName, templateName, packageSpec)
  const buildCommand = scenario.buildCommand(projectName, templateName, packageSpec)
  const devCommand = scenario.devCommand(projectName, templateName, packageSpec)

  await fs.mkdir(scenarioRoot, { recursive: true })

  const createMs = await timedRunCommand({
    cwd: scenarioRoot,
    command: createCommand.command,
    args: createCommand.args,
    timeoutMs: INSTALL_TIMEOUT_MS,
    label: `${labelPrefix} create`,
  })

  const projectDir = path.join(scenarioRoot, projectName)

  await validateCreatedProjectStructure(projectDir, templateName, `${labelPrefix} create`)

  const installMs = await timedRunCommand({
    cwd: projectDir,
    command: installCommand.command,
    args: installCommand.args,
    timeoutMs: INSTALL_TIMEOUT_MS,
    label: `${labelPrefix} install`,
  })

  const buildMs = await timedRunCommand({
    cwd: projectDir,
    command: buildCommand.command,
    args: buildCommand.args,
    timeoutMs: BUILD_TIMEOUT_MS,
    label: `${labelPrefix} build`,
  })

  const dev = await runDevSmoke(projectDir, `${labelPrefix} dev`, devCommand)

  return {
    scenario: scenario.name,
    template: templateName,
    createMs,
    installMs,
    buildMs,
    devReadyMs: dev.readyMs,
    devUpdateMs: dev.updateMs,
    projectDir,
  }
}

async function writeReport(report) {
  if (!REPORT_FILE) {
    return
  }

  const dir = path.dirname(REPORT_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-smoke-'))

  console.log(`Node ${process.version}`)
  console.log(`Package spec: ${DEFAULT_PACKAGE_SPEC}`)
  console.log(`Templates: ${TEMPLATE_NAMES.join(', ')}`)
  console.log(`Scenarios: ${SCENARIOS.map(scenario => scenario.name).join(', ')}`)
  console.log(`Workspace: ${tmpRoot}`)

  const results = []
  const failures = []

  for (const scenario of SCENARIOS) {
    for (const templateName of TEMPLATE_NAMES) {
      const scenarioRoot = path.join(tmpRoot, `${scenario.name}-${templateName}`)
      try {
        const result = await runScenario({
          scenario,
          templateName,
          packageSpec: DEFAULT_PACKAGE_SPEC,
          scenarioRoot,
        })
        results.push(result)
        console.log(`\n[${scenario.name}/${templateName}] OK`)
      }
      catch (error) {
        failures.push({
          packageManager: scenario.name,
          templateName,
          error,
        })
        console.error(`\n[${scenario.name}/${templateName}] FAILED`)
        console.error(error instanceof Error ? error.message : String(error))
      }
    }
  }

  await writeReport({
    ...REPORT_META,
    packageSpec: DEFAULT_PACKAGE_SPEC,
    templates: TEMPLATE_NAMES,
    scenarios: SCENARIOS.map(scenario => scenario.name),
    results,
    failures: failures.map(failure => ({
      scenario: failure.packageManager,
      template: failure.templateName,
      error: failure.error instanceof Error ? failure.error.message : String(failure.error),
    })),
  })

  if (failures.length > 0) {
    console.error(`\n${failures.length} scenario(s) failed.`)
    for (const failure of failures) {
      console.error(`- ${failure.packageManager}/${failure.templateName}`)
    }
    process.exitCode = 1
    return
  }

  console.log('\nAll create-weapp-vite smoke scenarios passed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
