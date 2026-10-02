import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

// 在已安装发布 tarball 的独立临时项目中执行，禁止指向真实业务项目。
const root = path.resolve(process.argv[2] ?? '')
assert(process.argv[2], 'Usage: node verify-vite-host-consumer.mjs <isolated-consumer-directory>')
const require = createRequire(path.join(root, 'package.json'))
const consumer = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
assert.equal(consumer.private, true, '消费验证项目必须是 private 临时项目')
assert(consumer.name.startsWith('weapp-vite-host-') || consumer.name === 'weapp-vite-plus-host-probe')
const weappPackage = require.resolve('weapp-vite/package.json')
assert(realpathSync(weappPackage).startsWith(`${realpathSync(root)}${path.sep}node_modules${path.sep}`), '必须安装 tarball，不能链接 workspace')
const plus = Boolean(consumer.dependencies?.['vite-plus'] ?? consumer.devDependencies?.['vite-plus'])
const standalone = process.argv[3] === 'wv'
const toolchain = standalone ? 'weapp-vite' : plus ? 'vite-plus' : 'vite'
const toolchainPackage = require.resolve(`${toolchain}/package.json`)
const cli = path.join(path.dirname(toolchainPackage), standalone ? 'bin/weapp-vite.js' : plus ? 'bin/vp' : 'bin/vite.js')
const compilerRequire = createRequire(weappPackage)
assert.equal(realpathSync(require.resolve('vite/package.json')), realpathSync(compilerRequire.resolve('vite/package.json')), '宿主和编译器必须解析到同一个 Vite')
const run = promisify(execFile)

async function command(file, args) {
  try {
    const result = await run(process.execPath, [file, ...args], { cwd: root, timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 10 * 1024 * 1024 })
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
  }
  catch (error) {
    process.stdout.write(error.stdout ?? '')
    process.stderr.write(error.stderr ?? '')
    throw error
  }
}

const files = {
  'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true } }),
  'tsconfig.types.json': JSON.stringify({ compilerOptions: { noEmit: true, strict: true, skipLibCheck: true, module: 'NodeNext' }, files: ['types.mts'] }),
  'vite.config.mts': `import { appendFileSync } from 'node:fs'
import { defineConfig } from '${toolchain}'
${standalone ? '' : 'import { weapp } from \'weapp-vite/vite\''}
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default defineConfig(async () => ({
  ${standalone ? '' : 'plugins: [weapp()],'}
  weapp: { platform: 'weapp', srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'classic' }, mcp: false },
  build: { outDir: 'dist', minify: false },
  test: { include: ['host.spec.ts'] },
}))
`,
  'weapp-vite.config.mjs': 'throw new Error("must not implicitly merge another configuration")',
  'project.config.json': JSON.stringify({ miniprogramRoot: 'dist' }),
  'src/app.ts': 'App({})',
  'src/app.json': JSON.stringify({ pages: ['pages/native/index', 'pages/vue/index'], subPackages: [{ root: 'extra', pages: ['detail/index'] }] }),
  'src/pages/native/index.ts': 'Page({ data: { message: "native-host" } })',
  'src/pages/native/index.json': '{}',
  'src/pages/native/index.wxml': '<view>{{message}}</view>',
  'src/pages/native/index.wxss': 'view { color: red; }',
  'src/pages/vue/index.vue': '<script setup lang="ts">const message: string = "vue-host"</script><template><view>{{message}}</view></template><style>view { color: blue; }</style>',
  'src/extra/detail/index.vue': '<template><view>subpackage-host</view></template>',
  'host.spec.ts': `import { existsSync } from 'node:fs'
import { expect, it } from '${plus ? 'vite-plus/test' : 'vitest'}'
it('configuration does not start compilation or generate support files', () => {
  expect(existsSync('dist')).toBe(false)
  expect(existsSync('.weapp-vite')).toBe(false)
})
`,
  'probe-host.mjs': `import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createServer, version } from 'vite'
const require = createRequire(import.meta.url)
const hostRequire = createRequire(require.resolve('vite/package.json'))
const engine = await import(pathToFileURL(hostRequire.resolve('${plus ? '@voidzero-dev/vite-plus-core/rolldown/experimental' : 'rolldown/experimental'}')).href)
assert.equal(typeof engine.dev, 'function')
assert.equal(typeof engine.scan, 'function')
const server = await createServer({ configFile: false, experimental: { bundledDev: true }, server: { middlewareMode: true }, logLevel: 'silent' })
try {
  const adapter = server.environments.client.bundledDev
  for (const method of ['getRolldownOptions', 'storeOutputFiles', 'listen']) assert.equal(typeof adapter?.[method], 'function', method)
  console.log('Vite ' + version + ': matched engine and bundled-development capability probe passed (not a stateful runtime test)')
} finally { await server.close() }
`,
  'types.mts': `import { defineConfig } from '${toolchain}'
import type { WeappViteConfig } from 'weapp-vite/config'
import { weapp } from 'weapp-vite/vite'
const config = defineConfig(async (_env) => ({
  ${standalone ? '' : 'plugins: [weapp()],'}
  weapp: { platform: 'weapp' },
  ${plus ? 'run: { tasks: { prepare: { command: \'wv prepare\', cache: false } } }, test: { include: [\'host.spec.ts\'] },' : ''}
}))
defineConfig({ weapp: { platform: 'web' } })
const resolved = await config({ command: 'build', mode: 'production' })
// Vite+ 的返回类型会正规化为宿主 UserConfig，保持其原有可选字段契约。
const platform: WeappViteConfig['platform'] = resolved.weapp?.platform
${plus ? 'resolved.run?.tasks; resolved.test?.include satisfies string[] | undefined' : ''}
defineConfig({ weapp: {
  // @ts-expect-error 平台必须来自已声明的联合类型
  platform: 'invalid-platform',
} })
defineConfig({ weapp: {
  // @ts-expect-error 小程序配置拼写错误不能被接受
  srcRoooot: 'src',
} })
// @ts-expect-error 插件只激活顶层配置，不接收第二套配置
weapp({ platform: 'weapp' })
void platform
`,
}
for (const [file, source] of Object.entries(files)) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true })
  await writeFile(path.join(root, file), source)
}
await rm(path.join(root, 'dist'), { recursive: true, force: true })
await rm(path.join(root, '.weapp-vite'), { recursive: true, force: true })
if (standalone) {
  await rm(path.join(root, 'weapp-vite.config.mjs'))
}
else if (plus) {
  await command(cli, ['test', 'run'])
}
else {
  const testCli = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
  await command(testCli, ['run'])
}
assert.equal(existsSync(path.join(root, 'dist')), false)
assert.equal(existsSync(path.join(root, '.weapp-vite')), false)
await command(require.resolve('typescript/bin/tsc'), ['-p', 'tsconfig.types.json'])
await command(path.join(root, 'probe-host.mjs'), [])
// 测试宿主必须使用有效 tsconfig；构建阶段再验证受管引用尚未生成的干净安装路径。
await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ references: [{ path: './.weapp-vite/tsconfig.app.json' }], files: [] }))
await writeFile(path.join(root, 'config-calls.txt'), '')
await command(cli, ['build'])
assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
const readOutput = file => readFile(path.join(root, 'dist', file), 'utf8')
assert.match(await readOutput('pages/native/index.js'), /native-host/)
assert.match(await readOutput('pages/native/index.wxml'), /message/)
assert.match(await readOutput('pages/vue/index.js'), /vue-host/)
assert.match(await readOutput('extra/detail/index.wxml'), /subpackage-host/)
assert.deepEqual(JSON.parse(await readOutput('app.json')).pages, ['pages/native/index', 'pages/vue/index'])
assert.equal(existsSync(path.join(root, 'dist/index.html')), false)
// 旧 CLI 保留双配置发现语义；只有标准插件忽略影子配置。
await rm(path.join(root, 'weapp-vite.config.mjs'), { force: true })
const wv = path.join(path.dirname(weappPackage), 'bin/weapp-vite.js')
await command(wv, ['prepare', '--config', 'vite.config.mts'])
assert.equal(existsSync(path.join(root, '.weapp-vite')), true)
await command(wv, ['build', '--config', 'vite.config.mts'])
assert.match(await readOutput('pages/native/index.js'), /native-host/)
console.log(`${toolchain}: packed exports, single host/config, TS/Vue/subpackage build and wv compatibility passed${standalone ? ' (standalone CLI without plugin registration)' : ', including test isolation'}`)

await command(path.join(import.meta.dirname, 'verify-vite-host-dev.mjs'), [root, standalone ? 'wv' : plus ? 'vite-plus' : 'vite'])
if (!standalone) {
  await command(path.join(import.meta.dirname, 'verify-vite-host-dev.mjs'), [root, plus ? 'vite-plus' : 'vite', 'build-watch'])
}

await command(path.join(import.meta.dirname, 'verify-vite-host-dev.mjs'), [root, standalone ? 'wv' : plus ? 'vite-plus' : 'vite', 'stateful-dev'])
