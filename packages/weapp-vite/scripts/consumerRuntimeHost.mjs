import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

/** 外部消费者必须使用自己安装的宿主；源码 fixture 保持原有 workspace 启动边界。 */
export function resolveRuntimeCompilerCli(host, projectRoot, { repositoryRoot, isolated = false }) {
  assert(['wv', 'vite', 'vite-plus'].includes(host), `Unsupported runtime compiler host: ${host}`)
  if (!isolated && host === 'wv') {
    return path.join(repositoryRoot, 'packages/weapp-vite/bin/weapp-vite.js')
  }
  const resolutionRoot = isolated || host === 'vite-plus' ? projectRoot : repositoryRoot
  const require = createRequire(path.join(resolutionRoot, 'package.json'))
  const packageName = host === 'wv' ? 'weapp-vite' : host
  const packageRoot = path.dirname(require.resolve(`${packageName}/package.json`))
  const cli = path.join(packageRoot, 'bin', host === 'wv' ? 'weapp-vite.js' : host === 'vite-plus' ? 'vp' : 'vite.js')
  if (isolated) {
    const relative = path.relative(path.join(realpathSync(projectRoot), 'node_modules'), realpathSync(cli))
    assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Runtime compiler escaped isolated consumer: ${packageName}`)
  }
  return cli
}

/** 单个发布消费者只执行所选宿主/模式，默认源码矩阵由原 suite 保持。 */
export function selectClassicRuntimeHost(host, mode = 'dev') {
  assert(['wv', 'vite', 'vite-plus'].includes(host), `Unsupported classic compiler host: ${host}`)
  assert(['dev', 'build-watch'].includes(mode), `Unsupported classic compiler mode: ${mode}`)
  assert(host !== 'wv' || mode === 'dev', 'Standalone classic consumer uses wv dev')
  return mode === 'build-watch' ? `${host}-watch` : host
}

/** 发布消费者与源码 fixture 使用相同的 HMR 场景，仅配置真实宿主入口。 */
export function createConsumerHmrConfig(host, runtime) {
  assert(['wv', 'vite', 'vite-plus'].includes(host), `Unsupported runtime compiler host: ${host}`)
  assert(['classic', 'stateful-experimental'].includes(runtime), `Unsupported consumer HMR runtime: ${runtime}`)
  return `import { defineConfig } from '${host === 'wv' ? 'weapp-vite' : host}'
${host === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
export default defineConfig({
  ${host === 'wv' ? '' : 'plugins: [weapp()],'}
  weapp: { srcRoot: 'src', appPrelude: { webRuntime: true }, hmr: { runtime: '${runtime}', logLevel: 'verbose' } },
})
`
}
