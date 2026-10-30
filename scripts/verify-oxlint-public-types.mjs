import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { applyDependencyTarballs, resolveDependencyTarballs } from './createWeappViteSmoke/dependencyTarballs.mjs'
import { runCommand } from './createWeappViteSmoke/process.mjs'
import { reportError } from './createWeappViteSmoke/registry.mjs'
import { cleanupSmokeDirectory } from './createWeappViteSmoke/reporting.mjs'
import { readPackedPackageJsonFromTarball } from './print-rolldown-versions.mjs'
import { managerCommand, strictEnvironment } from './verifyVitePlusTemplates/contracts.mjs'
import { runStep } from './verifyVitePlusTemplates/runner.mjs'

const requiredPackages = ['@weapp-vite/oxlint', '@weapp-vite/eslint']
const consumerSource = `import { miniProgramRecommended, reactRecommended, wevuRecommended } from '@weapp-vite/oxlint'
import plugin from '@weapp-vite/oxlint/plugin'

type IsAny<T> = 0 extends (1 & T) ? true : false
const createIsAny: IsAny<typeof plugin.rules['no-unsupported-runtime-api']['create']> = false
const pluginName: string = plugin.meta.name
const createRules = [
  plugin.rules['no-unsupported-runtime-api'].create,
  plugin.rules['no-implicit-runtime-polyfill'].create,
  plugin.rules['no-unsupported-api'].create,
  plugin.rules['no-risky-api'].create,
]
for (const preset of [miniProgramRecommended, wevuRecommended, reactRecommended]) {
  const plugins: Array<{ name: string, specifier: string }> = preset.jsPlugins
  void plugins
}
// @ts-expect-error 公开插件保留精确规则名，不能退化为任意索引。
plugin.rules['missing-rule']
// @ts-expect-error create 保留规则函数类型，不能退化为 any。
const invalidCreate: typeof plugin.rules['no-unsupported-api']['create'] = 'invalid'
void [createIsAny, pluginName, createRules, invalidCreate]
`

const compilerSource = `import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = fs.realpathSync(process.cwd())
const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\\n'))
  },
})
assert(parsed, 'Unable to parse isolated consumer tsconfig')
const program = ts.createProgram(parsed.fileNames, parsed.options)
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
for (const file of program.getSourceFiles()) {
  const relative = path.relative(root, fs.realpathSync(file.fileName))
  assert(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'TypeScript resolved a declaration outside the isolated consumer')
}
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => root,
    getNewLine: () => '\\n',
  }))
  process.exitCode = 1
}
else {
  console.log(JSON.stringify({ typescript: ts.version, checkedFiles: program.getSourceFiles().length, declarationsInsideConsumer: true }))
}
`

/** 独立安装已打包的规则包，验证公开类型不依赖仓库或未声明的 ESLint/Vite+ 类型。 */
export async function verifyOxlintPublicTypes(env = process.env, { execute = runCommand, readManifest = readPackedPackageJsonFromTarball } = {}) {
  const configured = await resolveDependencyTarballs(env.CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS)
  const artifacts = await Promise.all(requiredPackages.map(async (name) => {
    const artifact = configured.find(item => item.name === name)
    assert(artifact, `CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS must include ${name}`)
    const manifest = readManifest(artifact.tarball)
    assert.equal(manifest.name, name, `Candidate tarball package name mismatch: ${name}`)
    return { ...artifact, version: manifest.version, sha256: createHash('sha256').update(await fs.readFile(artifact.tarball)).digest('hex') }
  }))
  const installedTypescript = JSON.parse(await fs.readFile(fileURLToPath(import.meta.resolve('typescript/package.json')), 'utf8'))
  const typescriptVersion = env.OXLINT_PUBLIC_TYPES_TYPESCRIPT_VERSION || installedTypescript.version
  const registry = env.VITE_PLUS_TEMPLATE_REGISTRY || 'https://registry.npmjs.org/'
  const url = new URL(registry)
  assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Registry must be HTTP(S) without embedded credentials')
  const timeoutMs = Number(env.VITE_PLUS_TEMPLATE_TIMEOUT_MS ?? 600_000)
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'VITE_PLUS_TEMPLATE_TIMEOUT_MS must be a positive integer')
  const reportBase = path.resolve(env.OXLINT_PUBLIC_TYPES_REPORT_DIR || '.tmp/current-run/templates-vite-plus/public-types')
  await fs.mkdir(reportBase, { recursive: true })
  const reportRoot = await fs.mkdtemp(path.join(reportBase, 'run-'))
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-public-types-'))
  const reportFile = path.join(reportRoot, 'report.json')
  const report = {
    schemaVersion: 1,
    node: process.version,
    platform: process.platform,
    typescript: typescriptVersion,
    candidates: artifacts.map(({ name, filename, version, sha256 }) => ({ name, filename, version, sha256 })),
    status: 'in-progress',
    complete: false,
    steps: [],
  }
  const privateRoots = [temporaryRoot, os.homedir(), ...artifacts.map(item => item.tarball)]
  const flush = () => fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  const context = { id: 'oxlint-public-types', reportRoot, privateRoots, timeoutMs, steps: report.steps, flush }
  await flush()
  console.log(`Oxlint public types report: ${reportFile}`)
  try {
    const repositoryRoot = await fs.realpath(fileURLToPath(new URL('..', import.meta.url)))
    const relative = path.relative(repositoryRoot, await fs.realpath(temporaryRoot))
    assert(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Public types consumer must be outside the repository')
    await fs.writeFile(path.join(temporaryRoot, 'package.json'), `${JSON.stringify({
      name: 'oxlint-public-types-consumer',
      private: true,
      type: 'module',
      dependencies: { '@weapp-vite/oxlint': artifacts[0].version, 'typescript': typescriptVersion },
    }, null, 2)}\n`)
    await applyDependencyTarballs(temporaryRoot, artifacts)
    await fs.writeFile(path.join(temporaryRoot, 'tsconfig.json'), `${JSON.stringify({
      compilerOptions: { target: 'ES2022', lib: ['ES2022'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false, types: [] },
      files: ['consumer.mts'],
    }, null, 2)}\n`)
    await fs.writeFile(path.join(temporaryRoot, 'consumer.mts'), consumerSource)
    await fs.writeFile(path.join(temporaryRoot, 'compile.mjs'), compilerSource)
    const cacheRoot = path.join(temporaryRoot, 'cache')
    const runnerEnv = strictEnvironment(registry, cacheRoot, env)
    await runStep(context, 'install', {
      ...managerCommand('pnpm', ['install', '--config.auto-install-peers=false', '--config.hoist=false', '--config.node-linker=isolated'], registry, cacheRoot),
      cwd: temporaryRoot,
      env: runnerEnv,
    }, undefined, execute)
    for (const name of ['eslint', 'vite-plus']) {
      assert(!await fs.stat(path.join(temporaryRoot, 'node_modules', name)).catch(() => undefined), `Public types consumer must not install ${name}`)
    }
    await runStep(context, 'typecheck', { command: process.execPath, args: ['compile.mjs'], cwd: temporaryRoot, env: runnerEnv }, undefined, execute)
    report.complete = true
    report.status = 'passed'
  }
  catch (error) {
    report.status = 'failed'
    report.error = reportError(error, privateRoots)
  }
  finally {
    try {
      await cleanupSmokeDirectory(temporaryRoot)
      report.cleanup = 'passed'
    }
    catch (error) {
      report.status = 'failed'
      report.cleanup = 'failed'
      report.cleanupError = reportError(error, privateRoots)
    }
    await flush()
  }
  return { report, reportFile }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const { report } = await verifyOxlintPublicTypes()
  console.log(JSON.stringify({ status: report.status, complete: report.complete, candidates: report.candidates }, null, 2))
  process.exitCode = report.status === 'passed' && report.complete ? 0 : 1
}
