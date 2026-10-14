import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 外部消费协议通过真实发布 CLI 验证。
import { execa } from 'execa'
import { resolveRuntimeCompilerCli } from './consumerRuntimeHost.mjs'

const consumerRoot = path.resolve(process.argv[2] ?? '')
assert(process.argv[2], 'Usage: node verify-analyze-consumer.mjs <isolated-consumer-directory> [wv|vite|vite-plus]')
const toolchain = process.argv[3] ?? 'wv'
assert(['wv', 'vite', 'vite-plus'].includes(toolchain), 'Unsupported analyze consumer build host')
const require = createRequire(path.join(consumerRoot, 'package.json'))
const packageFile = require.resolve('weapp-vite/package.json')
assert(realpathSync(packageFile).startsWith(`${realpathSync(consumerRoot)}${path.sep}node_modules${path.sep}`), 'Analyze CLI must resolve inside the installed consumer')
const cli = path.join(path.dirname(packageFile), 'bin/weapp-vite.js')
const buildCli = resolveRuntimeCompilerCli(toolchain, consumerRoot, { isolated: true })
const verifier = path.join(import.meta.dirname, 'verify-analyze-artifacts.mjs')
const root = await mkdtemp(path.join(consumerRoot, 'analyze-consumer-'))
const outputDirectory = path.join(root, 'dist')
const reportFile = path.join(root, 'report.json')
const configFile = 'vite.config.mts'
const diagnostic = 'analyze consumer config diagnostic'
const run = (entry, args) => execa(process.execPath, [entry, ...args], { cwd: root, reject: false, timeout: 120_000 })
async function write(file, content) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true })
  await writeFile(path.join(root, file), content)
}
function config(minify, limit = 10_000_000) {
  return `import { defineConfig } from '${toolchain === 'wv' ? 'weapp-vite' : toolchain}'
${toolchain === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
console.log('${diagnostic}')
export default defineConfig({
  ${toolchain === 'wv' ? '' : 'plugins: [weapp()],'}
  build: { minify: ${minify}, rolldownOptions: { output: { chunkFileNames: 'segments/[name]-[hash].js' } } },
  weapp: { autoRoutes: false, srcRoot: 'src', analyze: { history: false, budgets: { runtimeBytes: ${limit} } } },
})
`
}

async function outputFiles(directory = outputDirectory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await outputFiles(file))
    }
    else {
      assert(entry.isFile(), `Unexpected non-file artifact: ${entry.name}`)
      files.push(path.relative(outputDirectory, file).split(path.sep).join('/'))
    }
  }
  return files.sort()
}

function duplicateEstimate(report) {
  const packages = new Map(report.packages.flatMap(pkg => pkg.files.map(file => [file.file, file])))
  const artifacts = new Map(report.artifacts.files.map(file => [file.file, file]))
  let duplicateBytes = 0
  // 由源码 id 的实际物理落点重建副本，保留最大一份；不复用分类器或字节分摊实现。
  for (const module of report.modules) {
    const placements = new Set(module.packages.flatMap(pkg => pkg.files))
    const copies = [...placements].flatMap((file) => {
      const raw = packages.get(file)?.modules?.find(item => item.id === module.id)
      if (!raw || raw.bytes === 0) {
        return []
      }
      const estimates = artifacts.get(file).modules.filter(item => item.source === module.source)
      assert.equal(estimates.length, 1, `Module placement must have one estimate: ${module.source} in ${file}`)
      return [estimates[0].estimatedBytes]
    }).sort((left, right) => right - left)
    duplicateBytes += copies.slice(1).reduce((sum, bytes) => sum + bytes, 0)
  }
  return duplicateBytes
}

function validateAccounting(report) {
  assert.equal(report.schemaVersion, 2)
  assert.match(report.build.id, /^[a-f\d]{64}$/)
  assert.equal(report.build.platform, 'weapp')
  assert.equal(report.build.mode, 'staging')
  const artifacts = report.artifacts.files
  assert(artifacts.length > 0)
  assert.equal(new Set(artifacts.map(file => file.file)).size, artifacts.length, 'Physical artifacts must be counted once')
  assert.equal(artifacts.reduce((sum, file) => sum + file.bytes, 0), report.artifacts.totalBytes)
  assert(artifacts.some(file => file.modules.some(module => module.package?.name === 'wevu')), 'Missing installed runtime ownership')
  assert(artifacts.some(file => file.packageId === 'extra'), 'Missing subpackage ownership')
  assert(artifacts.some(file => file.packageId === 'isolated' && file.origin === 'independent'), 'Missing independent output ownership')
  const shared = artifacts.filter(file => file.origin === 'main' && file.modules.some(module => module.source === 'shared.ts'))
  assert.equal(shared.length, 1, 'Main and regular subpackage must use one physical shared module')
  assert(shared[0].file.startsWith('segments/'), 'Shared chunk must use the configured output directory')
  const importers = report.packages.flatMap(pkg => pkg.files)
    .filter(file => file.from === 'main' && file.imports?.includes(shared[0].file))
  assert(importers.length >= 2, 'Renamed shared chunk must be imported by multiple emitted entries')
  const duplicateBytes = duplicateEstimate(report)
  assert(duplicateBytes > 0, 'Independent fixture must exercise actual duplicated modules')
  assert(Math.abs(duplicateBytes - report.artifacts.duplicateEstimatedBytes) < 1e-6, 'Duplicate estimate must agree with independently reconstructed physical copies')
  assert(report.artifacts.runtime.upperBoundBytes > 0)
  assert(report.artifacts.runtime.estimatedBytes <= report.artifacts.runtime.upperBoundBytes)
  const totalBudget = report.budgetChecks.find(item => item.scope === 'total')
  assert.equal(totalBudget.currentBytes, report.artifacts.totalBytes)
  for (const pkg of report.packages) {
    const packageArtifacts = artifacts.filter(file => file.packageId === pkg.id)
    const budget = report.budgetChecks.find(item => item.id === pkg.id)
    assert.equal(budget.currentBytes, packageArtifacts.reduce((sum, file) => sum + file.bytes, 0))
    assert.deepEqual(budget.files, packageArtifacts.map(file => file.file).sort())
  }
  for (const file of artifacts) {
    assert(file.runtimeEstimatedBytes <= file.bytes)
    assert(file.unattributedBytes >= 0)
    assert(file.modules.reduce((sum, module) => sum + module.estimatedBytes, 0) <= file.bytes + 1e-6)
  }
  return { sharedFile: shared[0].file, sharedImporters: importers.map(file => file.file).sort(), duplicateEstimatedBytes: duplicateBytes }
}

try {
  await write('package.json', JSON.stringify({ private: true, type: 'module' }))
  await write('project.config.json', JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/' }))
  await write('project.private.config.json', JSON.stringify({ condition: { miniprogram: { list: [
    { name: 'native', pathName: 'pages/index/index' },
    { name: 'sfc', pathName: 'extra/detail/index' },
    { name: 'independent', pathName: 'isolated/detail/index' },
  ] } } }))
  await write('src/app.json', JSON.stringify({ pages: ['pages/index/index'], subPackages: [
    { root: 'extra', pages: ['detail/index'] },
    { root: 'isolated', pages: ['detail/index'], independent: true },
  ] }))
  await write('src/app.ts', 'App({})')
  await write('src/shared.ts', 'export const message = "shared-analyze-consumer"')
  await write('src/pages/index/index.ts', 'import { ref } from "wevu"; import { message } from "../../shared"; Page({ data: { message, count: ref(1).value } })')
  await write('src/pages/index/index.wxml', '<view>{{message}}:{{count}}</view>')
  await write('src/pages/index/index.json', '{}')
  await write('src/extra/detail/index.vue', '<script setup lang="ts">import { ref } from "wevu"; import { message } from "../../shared"; const value = ref(message)</script><template><view>{{value}}</view></template>')
  await write('src/isolated/detail/index.vue', '<script setup lang="ts">import { ref } from "wevu"; import { message } from "../../shared"; const value = ref(message)</script><template><view>{{value}}</view></template>')
  const builds = []
  for (const minify of [false, true]) {
    await write(configFile, config(minify))
    await rm(outputDirectory, { recursive: true, force: true })
    const built = await run(buildCli, ['build', '--config', configFile, '--mode', 'staging'])
    assert.equal(built.exitCode, 0, built.stderr || built.stdout)
    const analyzed = await run(cli, ['analyze', '--config', configFile, '--mode', 'staging', '--json', '--budget-check'])
    assert.equal(analyzed.exitCode, 0, analyzed.stderr)
    assert(analyzed.stderr.includes(diagnostic), 'Config diagnostics must be routed to stderr')
    const report = JSON.parse(analyzed.stdout)
    const accounting = validateAccounting(report)
    assert.deepEqual(await outputFiles(), report.artifacts.files.map(file => file.file).sort(), 'Installed build output must match the complete physical artifact inventory')
    await writeFile(reportFile, analyzed.stdout)
    const verified = await run(verifier, [reportFile, outputDirectory])
    assert.equal(verified.exitCode, 0, verified.stderr)
    builds.push({ minify, buildId: report.build.id, ...accounting, ...JSON.parse(verified.stdout) })
  }
  assert.notEqual(builds[0].buildId, builds[1].buildId, 'Distinct minification output must receive distinct build identities')
  await write(configFile, config(true, 1))
  const failed = await run(cli, ['analyze', '--config', configFile, '--mode', 'staging', '--json', '--budget-check'])
  assert.equal(failed.exitCode, 1, 'Runtime budget failure must return nonzero')
  const report = JSON.parse(failed.stdout)
  const budget = report.budgetChecks.find(item => item.scope === 'runtime')
  assert.equal(budget.status, 'exceeded')
  assert.equal(budget.measurement, 'upper-bound')
  assert(budget.files.length > 0)
  assert(budget.files.every(file => report.artifacts.files.some(artifact => artifact.file === file)))
  const removed = budget.files[0]
  await rm(path.join(outputDirectory, removed))
  const missing = await run(verifier, [reportFile, outputDirectory])
  assert.notEqual(missing.exitCode, 0, 'A missing artifact must fail consumer verification')
  assert(missing.stderr.includes(path.basename(removed)), 'Missing artifact failure must locate the file')
  console.log(JSON.stringify({ analyzeConsumer: { schemaVersion: 2, installationScope: 'consumer-node_modules', buildHost: toolchain, analyzeHost: 'wv', builds, budgetFailure: { scope: budget.scope, files: budget.files }, missingArtifact: removed } }))
}
finally {
  await rm(root, { recursive: true, force: true })
}
