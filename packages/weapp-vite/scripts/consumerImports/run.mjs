import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies -- 消费验证必须保持跨平台命令解析。
import { execa } from 'execa'
import { createNativeHostControl } from '../consumerHmr/hostControl/index.mjs'
import { consumerProcessEnvironment, stopConsumerProcess } from '../consumerHmr/shutdown.mjs'
import { createConsumerRuntimeEnvironment } from '../consumerRuntimeEnvironment.mjs'
import { importsConsumerEnvironment } from './environment.mjs'
import { importsConsumerConfig, writeImportsFixture } from './fixture.mjs'
import { inspectOriginalDependencies } from './provenance.mjs'

const root = path.resolve(process.argv[2])
const toolchain = process.argv[3]
assert(['wv', 'vite', 'vite-plus'].includes(toolchain))
const require = createRequire(path.join(root, 'package.json'))
const packageJson = path.join(root, 'package.json')
const consumer = JSON.parse(await readFile(packageJson, 'utf8'))
assert(consumer.private && consumer.name.startsWith('weapp-vite-host-'))
const evidence = { toolchain, dependencies: await inspectOriginalDependencies(root, toolchain), checks: [] }
async function saveEvidence() {
  if (process.env.WEAPP_VITE_IMPORTS_EVIDENCE) {
    const output = path.resolve(process.env.WEAPP_VITE_IMPORTS_EVIDENCE)
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  }
}
// 首次构建失败时也保留已经完成的官方依赖来源核验。
await saveEvidence()
const host = toolchain === 'wv' ? 'weapp-vite' : toolchain
const cli = path.join(path.dirname(require.resolve(`${host}/package.json`)), toolchain === 'wv' ? 'bin/weapp-vite.js' : toolchain === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
consumer.imports = { '#text/*': './src/data/*.js', '#exact?raw': './src/data/exact.js' }
await writeFile(packageJson, JSON.stringify(consumer, null, 2))
await rm(path.join(root, 'src'), { recursive: true, force: true })
await writeImportsFixture(root, toolchain)

async function javascript(directory, excluded = new Set()) {
  const sources = []
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) {
        sources.push(await javascript(filename))
      }
    }
    else if (entry.name.endsWith('.js')) {
      sources.push(await readFile(filename, 'utf8'))
    }
  }
  return sources.join('\n')
}

const buildOptions = { cwd: root, env: importsConsumerEnvironment(), extendEnv: false, stdio: 'inherit' }
const mainJavascript = () => javascript(path.join(root, 'dist'), new Set(['independent', 'workers']))
await execa(process.execPath, [cli, 'build'], buildOptions)
assert.match(await mainJavascript(), /imports-source-before/, 'main wildcard query')
assert.match(await readFile(path.join(root, 'dist/pages/index/index.js'), 'utf8'), /Page\(/)
for (const directory of ['dist/independent', 'dist/workers']) {
  assert.match(await javascript(path.join(root, directory)), /imports-source-before/, `${directory} wildcard query`)
}
assert.match(await javascript(path.join(root, 'dist')), /imports-exact-key/)
evidence.checks.push('main, independent and worker build; exact query key')

await writeFile(path.join(root, 'config-calls.txt'), '')
const control = toolchain === 'wv' ? undefined : await createNativeHostControl(root, 'vite.config.mts')
const child = execFile(process.execPath, [cli, 'dev', ...control ? ['--config', control.configFile] : []], {
  cwd: root,
  detached: process.platform !== 'win32',
  maxBuffer: 10 * 1024 * 1024,
  env: consumerProcessEnvironment('dev', importsConsumerEnvironment(), { explicitControl: Boolean(control) }),
})
let logs = ''
let exited = false
const done = new Promise((resolve) => {
  child.once('error', error => resolve({ error }))
  child.once('exit', (code, signal) => {
    exited = true
    resolve({ code, signal })
  })
})
child.stdout.on('data', data => logs += data)
child.stderr.on('data', data => logs += data)
async function waitFor(check, label) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (exited) {
      break
    }
    if (await check()) {
      return
    }
    await delay(50)
  }
  throw new Error(`Imports consumer timed out: ${label}\n${logs}`)
}
const errors = []
try {
  await waitFor(() => /开发服务已就绪|小程序开发产物已就绪/.test(logs), 'development ready')
  await writeFile(path.join(root, 'src/data/value.js'), 'export const marker = "imports-source-updated"')
  await waitFor(async () => (await mainJavascript()).includes('imports-source-updated'), 'raw source update')
  evidence.checks.push('development raw source update')
  consumer.imports['#text/*'] = './src/alternative/*.js'
  await writeFile(packageJson, JSON.stringify(consumer, null, 2))
  await writeFile(path.join(root, 'vite.config.mts'), importsConsumerConfig(toolchain, 'config-after'))
  await waitFor(async () => {
    const source = await mainJavascript()
    return source.includes('imports-mapping-after') && source.includes('config-after')
  }, 'configuration restart and package imports invalidation')
  assert((await readFile(path.join(root, 'config-calls.txt'), 'utf8')).trim().split(/\r?\n/).length >= 2)
  evidence.checks.push('configuration restart with changed package imports')
}
catch (error) {
  errors.push(error)
}
finally {
  await stopConsumerProcess({ child, done, operation: 'dev', toolchain, requestShutdown: control && (() => control.requestClose()), disposeShutdown: control && (() => control.dispose()) }).catch(error => errors.push(error))
}
if (errors.length) {
  throw new AggregateError(errors, 'Imports consumer failed', { cause: errors[0] })
}

const runtime = process.env.WEAPP_VITE_IMPORTS_RUNTIME
if (runtime) {
  assert(['headless', 'devtools', 'both'].includes(runtime))
  const file = 'e2e/consumers/package-imports.runtime.test.ts'
  const cases = [{ file, name: 'published package imports runtime > renders wildcard raw sources and exact query keys in main and independent pages' }]
  for (const provider of runtime === 'both' ? ['headless', 'devtools'] : [runtime]) {
    await execa('pnpm', ['vitest', 'run', '-c', 'e2e/vitest.e2e.devtools.config.ts', file], {
      cwd: new URL('../../../../', import.meta.url),
      env: {
        ...importsConsumerEnvironment(),
        ...createConsumerRuntimeEnvironment(provider, toolchain, 'WEAPP_VITE_E2E_IMPORTS_PROJECT', root, cases),
        WEAPP_VITE_E2E_TARGET_FILE: 'consumers/package-imports.runtime.test.ts',
      },
      extendEnv: false,
      stdio: 'inherit',
    })
    evidence.checks.push(`${provider} raw source and exact key runtime in main and independent pages`)
  }
}

// Web 使用相同发布包的自动插件链，无需给消费者安装内部兼容插件。
await writeFile(path.join(root, 'vite.config.mts'), `import { defineConfig } from '${host}'
${toolchain === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
export default defineConfig({ ${toolchain === 'wv' ? '' : 'plugins: [weapp()],'} weapp: { platform: 'web', srcRoot: 'src', mcp: false } })
`)
await writeFile(path.join(root, 'index.html'), '<div id="app"></div><script type="module" src="/web-entry.js"></script>')
await writeFile(path.join(root, 'web-entry.js'), 'import text from "#text/value?raw"; import exact from "#exact?raw"; document.querySelector("#app").textContent = text + exact')
await execa(process.execPath, [cli, 'build'], buildOptions)
assert.match(await javascript(path.join(root, 'dist/web')), /imports-mapping-after/)
assert.match(await javascript(path.join(root, 'dist/web')), /imports-exact-key/)
evidence.checks.push('Web build')
await saveEvidence()
console.log(JSON.stringify(evidence, null, 2))
