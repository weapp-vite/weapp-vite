import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const root = path.resolve(import.meta.dirname, '..')
const { values } = parseArgs({
  options: { output: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (values.help) {
  process.stdout.write('用法：node scripts/profile-native-default-export.mjs [--output <新目录>]\n仅测暖 compileVueFile 入口；不覆盖完整构建、HMR、runtime 或 RSS。\n')
  process.exit(0)
}

const rounds = 40
const warmupPairs = 10
const files = [
  'apps/wevu-comprehensive-demo/src/pages/component-interop/index.vue',
  'apps/wevu-comprehensive-demo/src/pages/slot/index.vue',
  'apps/wevu-comprehensive-demo/src/pages/created-setup/index.vue',
  'e2e-apps/wevu-runtime-e2e/src/pages/function-props-auto/index.vue',
  'e2e-apps/wevu-runtime-e2e/src/pages/non-function-prop-bind/index.vue',
  'e2e-apps/stateful-hmr/src/components/vue-counter/index.vue',
]
const output = path.resolve(root, values.output ?? '.tmp/native-default-export-profile')
await mkdir(path.dirname(output), { recursive: true })
try {
  await mkdir(output)
}
catch (error) {
  if (error.code === 'EEXIST') {
    throw new Error('--output 目录已存在，请选择新目录以保留历史证据。')
  }
  throw error
}

process.env.WEAPP_VITE_NATIVE_AST_PATH = path.join(root, 'packages/ast-native/index.js')
const digest = value => createHash('sha256').update(value).digest('hex')

async function listArtifacts(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) {
      return listArtifacts(file)
    }
    assert(entry.isFile(), `${file}: 构建产物必须是普通文件`)
    return [file]
  }))
  return nested.flat()
}

async function freeze() {
  const addonEntries = await readdir(path.join(root, 'packages/ast-native'), { withFileTypes: true })
  const binaries = addonEntries.filter(entry => entry.isFile() && entry.name.endsWith('.node'))
    .map(entry => path.posix.join('packages/ast-native', entry.name))
  assert(binaries.length, '未找到本地 native .node 产物，请先构建 @weapp-vite/ast-native。')
  const artifacts = [
    ...await listArtifacts('packages-runtime/wevu-compiler/dist'),
    ...await listArtifacts('packages/ast/dist'),
    'packages/ast-native/index.js',
    ...binaries,
    ...files,
    'pnpm-lock.yaml',
    'scripts/profile-native-default-export.mjs',
  ].sort()
  return Promise.all(artifacts.map(async file => ({
    file,
    sha256: digest(await readFile(path.join(root, file))),
  })))
}

const report = {
  status: 'running',
  rounds,
  warmupPairs,
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  boundary: 'Warm actual dist compileVueFile entry on six original repository SFCs in one Node process; default compile options plus warning capture. Does not cover complete build, HMR, runtime or RSS.',
  sides: { babel: 'WEAPP_VITE_NATIVE=0', native: 'WEAPP_VITE_NATIVE=1 with local packages/ast-native/index.js' },
  parity: 'Every warmup and measured result, source map and warning list must deep-equal the first native-off result for that SFC.',
  identity: [],
  finalIdentity: [],
  samples: [],
  summary: [],
}
const save = () => writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)

function quantile(values, percentile) {
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * percentile) - 1]
}

try {
  report.identity = await freeze()
  await save()
  // 加载已冻结的本地产物；旧 addon 不提供本次事实时不能冒充 native 采样。
  const addon = await import(pathToFileURL(process.env.WEAPP_VITE_NATIVE_AST_PATH).href)
  assert.equal(typeof addon.analyzeCompilerScriptsNative, 'function', '本地 addon 缺少批量编译器分析入口。')
  const probe = addon.analyzeCompilerScriptsNative([{ code: 'export default {}', filename: 'profile.ts' }])
  assert.equal(probe[0]?.hasDefaultExport, true, '本地 addon 缺少有效 hasDefaultExport 事实，请重建。')
  const { compileVueFile } = await import(pathToFileURL(path.join(root, 'packages-runtime/wevu-compiler/dist/index.mjs')).href)
  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8')
    let oracle
    for (let round = -warmupPairs; round < rounds; round++) {
      const order = round % 2 ? ['native', 'babel'] : ['babel', 'native']
      for (const side of order) {
        process.env.WEAPP_VITE_NATIVE = side === 'native' ? '1' : '0'
        const warnings = []
        const cpu = process.cpuUsage()
        const start = performance.now()
        const result = await compileVueFile(source, file, { warn: message => warnings.push(message) })
        const wallMs = performance.now() - start
        const cpuUsage = process.cpuUsage(cpu)
        const evidence = { result, warnings }
        oracle ??= evidence
        assert.deepEqual(evidence, oracle, `${file}: ${side} 输出、source map 或告警不一致`)
        if (round >= 0) {
          report.samples.push({
            file,
            round,
            side,
            wallMs,
            cpuMs: (cpuUsage.user + cpuUsage.system) / 1000,
            evidenceSha256: digest(JSON.stringify(evidence)),
          })
        }
      }
    }
    process.stdout.write(`${file}: ${rounds} alternating pairs passed\n`)
    await save()
  }
  report.finalIdentity = await freeze()
  assert.deepEqual(report.finalIdentity, report.identity, '采样期间源码或构建产物发生变化，本次结果无效。')
  report.summary = files.map((file) => {
    const rows = ['babel', 'native'].map((side) => {
      const samples = report.samples.filter(row => row.file === file && row.side === side)
      assert.equal(samples.length, rounds)
      return {
        side,
        count: samples.length,
        wallP50Ms: quantile(samples.map(row => row.wallMs), 0.5),
        wallP95Ms: quantile(samples.map(row => row.wallMs), 0.95),
        cpuP50Ms: quantile(samples.map(row => row.cpuMs), 0.5),
        cpuP95Ms: quantile(samples.map(row => row.cpuMs), 0.95),
      }
    })
    return {
      file,
      rows,
      wallP50ChangePercent: (rows[1].wallP50Ms / rows[0].wallP50Ms - 1) * 100,
      wallP95ChangePercent: (rows[1].wallP95Ms / rows[0].wallP95Ms - 1) * 100,
      cpuP50ChangePercent: (rows[1].cpuP50Ms / rows[0].cpuP50Ms - 1) * 100,
      cpuP95ChangePercent: (rows[1].cpuP95Ms / rows[0].cpuP95Ms - 1) * 100,
    }
  })
  report.status = 'complete'
}
catch (error) {
  report.status = 'failed'
  report.error = String(error.stack ?? error).replaceAll(root, '<repository>')
  throw error
}
finally {
  await save()
}
process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`)
