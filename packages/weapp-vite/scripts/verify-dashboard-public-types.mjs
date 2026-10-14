import assert from 'node:assert/strict'
import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 严格消费者安装需跨平台解析 npm 启动器。
import { execa } from 'execa'
import { createConsumerTemporaryRoot, packConsumerTarballs, readConsumerTarballs, verifyConsumerTarballProvenance } from './consumerTarballs.mjs'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoot = await createConsumerTemporaryRoot()
const consumerRoot = path.join(temporaryRoot, 'consumer')
const evidenceFile = path.resolve(process.env.WEAPP_VITE_DASHBOARD_TYPES_EVIDENCE ?? path.join(repoRoot, '.cache/dashboard-public-types.json'))
const evidence = { schemaVersion: 1, node: process.version, manager: 'npm', strictPeers: true, commands: [] }
const env = {
  NODE_OPTIONS: '',
  NODE_PATH: '',
  npm_config_legacy_peer_deps: 'false',
  npm_config_force: 'false',
  npm_config_ignore_scripts: 'false',
  npm_config_engine_strict: 'true',
  npm_config_cache: path.join(temporaryRoot, 'npm-cache'),
}

function diagnostic(text) {
  return text.replaceAll(consumerRoot, '<consumer>')
    .replaceAll(consumerRoot.replaceAll('\\', '/'), '<consumer>')
    .replaceAll(temporaryRoot, '<temporary>')
    .replaceAll(temporaryRoot.replaceAll('\\', '/'), '<temporary>')
    .replaceAll(repoRoot, '<repository>')
    .replaceAll(repoRoot.replaceAll('\\', '/'), '<repository>')
}

/** 命令输出在消费者清理后仍保留；失败不会回退工作区编译器或放宽声明检查。 */
async function run(label, command, args, timeout) {
  const result = await execa(command, args, { cwd: consumerRoot, env, reject: false, timeout })
  evidence.commands.push({
    label,
    exitCode: result.exitCode,
    failed: result.failed,
    code: result.code,
    shortMessage: typeof result.shortMessage === 'string' ? diagnostic(result.shortMessage) : undefined,
    timedOut: result.timedOut,
    signal: result.signal,
    stdout: diagnostic(result.stdout),
    stderr: diagnostic(result.stderr),
  })
  if (result.failed) {
    throw result
  }
  assert.equal(result.exitCode, 0, `Strict Dashboard consumer failed: ${label}; see the recorded diagnostics`)
}

function assertInstalledPath(modules, file) {
  const relative = path.relative(modules, file)
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Consumer resolution escaped the installed dependency tree')
}

let failure
try {
  await mkdir(consumerRoot)
  const archiveDirectory = process.env.WEAPP_VITE_CONSUMER_TARBALLS
  const candidates = archiveDirectory
    ? await readConsumerTarballs(path.resolve(archiveDirectory), ['weapp-vite'])
    : await packConsumerTarballs(repoRoot, path.join(temporaryRoot, 'archives'), ['weapp-vite'])
  for (const name of ['@weapp-vite/dashboard', '@devframes/agentic', '@devframes/hub', '@devframes/hub-ui']) {
    assert(!Object.hasOwn(candidates, name), 'The strict core type consumer must not add optional Dashboard hosts')
  }
  await writeFile(path.join(consumerRoot, 'package.json'), JSON.stringify({
    name: 'weapp-vite-dashboard-public-types-consumer',
    private: true,
    type: 'module',
    dependencies: candidates,
    overrides: candidates,
    devDependencies: { '@types/node': '26.6.5', 'typescript': '6.0.3' },
  }, null, 2))
  await cp(fileURLToPath(new URL('../test/fixtures/dashboard-public-types/', import.meta.url)), consumerRoot, { recursive: true })
  await run('install', 'npm', ['install', '--strict-peer-deps', '--no-audit', '--no-fund'], 900_000)
  evidence.verifiedCandidates = await verifyConsumerTarballProvenance(consumerRoot, candidates)

  const modules = await realpath(path.join(consumerRoot, 'node_modules'))
  const require = createRequire(path.join(consumerRoot, 'package.json'))
  const manifestFile = await realpath(require.resolve('weapp-vite/package.json'))
  const tsc = await realpath(require.resolve('typescript/bin/tsc'))
  assertInstalledPath(modules, manifestFile)
  assertInstalledPath(modules, tsc)
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  assert.equal(manifest.name, 'weapp-vite')
  const coreRequire = createRequire(manifestFile)
  for (const name of ['@weapp-vite/dashboard', '@devframes/agentic', '@devframes/hub', '@devframes/hub-ui']) {
    assert.throws(() => coreRequire.resolve(`${name}/package.json`), { code: 'MODULE_NOT_FOUND' })
  }
  for (const entry of ['./dashboard', './dashboard/analyze']) {
    const declaration = await realpath(path.resolve(path.dirname(manifestFile), manifest.exports[entry].types))
    assertInstalledPath(modules, declaration)
  }
  evidence.version = manifest.version
  evidence.compiler = path.relative(modules, tsc).replaceAll('\\', '/')
  evidence.compilerOptions = JSON.parse(await readFile(path.join(consumerRoot, 'tsconfig.json'), 'utf8')).compilerOptions
  await run('public-types', process.execPath, [tsc, '--project', 'tsconfig.json'], 120_000)
  await verifyConsumerTarballProvenance(consumerRoot, candidates)
}
catch (error) {
  failure = error
  evidence.failure = diagnostic(String(error))
  if (error.stdout || error.stderr) {
    evidence.failureOutput = { stdout: diagnostic(error.stdout ?? ''), stderr: diagnostic(error.stderr ?? '') }
  }
}
finally {
  try {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
  catch (error) {
    evidence.cleanupFailure = diagnostic(String(error))
    failure = new AggregateError([...(failure ? [failure] : []), error], 'Strict Dashboard consumer or owned temporary-directory cleanup failed')
  }
  evidence.passed = !failure
  await mkdir(path.dirname(evidenceFile), { recursive: true })
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
}
if (failure) {
  throw failure
}
console.log('Packed Dashboard public types passed with NodeNext, strict declarations and Node-only ambient types.')
