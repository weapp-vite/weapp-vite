import assert from 'node:assert/strict'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 三入口平台消费使用跨平台命令执行。
import { execa } from 'execa'
import { createConsumerRuntimeEnvironment } from './consumerRuntimeEnvironment.mjs'

/** 独立发布包中的六平台原生命令矩阵，配置仅使用顶层目标选择。 */
export async function verifyPlatformConsumer(root, host, repoRoot, runtime) {
  const fixture = path.join(repoRoot, 'templates/weapp-vite-multi-platform-sfc-template')
  await rm(path.join(root, 'src'), { recursive: true, force: true })
  for (const file of ['src', 'config', 'tsconfig.json']) {
    await cp(path.join(fixture, file), path.join(root, file), { recursive: true })
  }
  const require = createRequire(path.join(root, 'package.json'))
  const packageName = host === 'wv' ? 'weapp-vite' : host
  const cli = path.join(path.dirname(require.resolve(`${packageName}/package.json`)), host === 'wv' ? 'bin/weapp-vite.js' : host === 'vite-plus' ? 'bin/vp' : 'bin/vite.js')
  for (const [platform, templateExt, styleExt, projectFile] of [
    ['weapp', 'wxml', 'wxss', 'project.config.json'],
    ['alipay', 'axml', 'acss', 'mini.project.json'],
    ['tt', 'ttml', 'ttss', 'project.config.json'],
    ['swan', 'swan', 'css', 'project.swan.json'],
    ['jd', 'jxml', 'jxss', 'project.config.json'],
    ['xhs', 'xhsml', 'css', 'project.config.json'],
  ]) {
    const projectPath = path.join(root, 'config', platform, projectFile)
    const project = JSON.parse(await readFile(projectPath, 'utf8'))
    project.setting = { ...project.setting, packNpmManually: false, es6: false }
    delete project.setting.packNpmRelationList
    await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`)
    const config = `import { appendFileSync } from 'node:fs'
import { defineConfig } from '${packageName}'
${host === 'wv' ? '' : 'import { weapp } from \'weapp-vite/vite\''}
appendFileSync(new URL('./config-calls.txt', import.meta.url), 'loaded\\n')
export default defineConfig({
  ${host === 'wv' ? '' : 'plugins: [weapp()],'}
  weapp: { platform: '${platform}', srcRoot: 'src', multiPlatform: true, injectWeapi: { enabled: true, replaceWx: true }, hmr: { runtime: 'classic' } },
})
`
    await writeFile(path.join(root, 'vite.config.mts'), config)
    await writeFile(path.join(root, `vite.${platform}.config.mts`), config)
    await writeFile(path.join(root, 'config-calls.txt'), '')
    await execa(process.execPath, [cli, 'build'], { cwd: root, stdio: 'inherit' })
    assert.equal(await readFile(path.join(root, 'config-calls.txt'), 'utf8'), 'loaded\n')
    const outDir = path.join(root, 'dist', platform, 'dist')
    const app = JSON.parse(await readFile(path.join(outDir, 'app.json'), 'utf8'))
    assert.deepEqual(app.pages, ['pages/index/index'])
    assert((await readFile(path.join(outDir, `pages/index/index.${templateExt}`), 'utf8')).includes('platform-marker'))
    assert((await readFile(path.join(outDir, `components/PlatformCard/index.${templateExt}`), 'utf8')).includes('component-platform'))
    assert((await readFile(path.join(outDir, `pages/index/index.${styleExt}`), 'utf8')).includes('counter-panel'))
    assert((await readFile(path.join(outDir, 'pages/index/index.js'), 'utf8')).includes(platform))
    assert(await readFile(path.join(root, 'dist', platform, projectFile), 'utf8'))
    const npmDirectory = platform === 'alipay' ? 'node_modules' : 'miniprogram_npm'
    assert(await readFile(path.join(outDir, npmDirectory, '@weapp-core/constants/index.js'), 'utf8'))
    for (const operation of host === 'wv' ? ['dev'] : ['dev', 'build-watch']) {
      await execa(process.execPath, [path.join(repoRoot, 'packages/weapp-vite/scripts/verify-vite-host-dev.mjs'), root, host, operation, 'platform', platform], { cwd: repoRoot, stdio: 'inherit' })
    }
    console.log(`${host}: ${platform} production and development passed`)
  }
  for (const provider of runtime === 'both' ? ['headless', 'devtools'] : [runtime]) {
    await execa('pnpm', ['vitest', 'run', '-c', 'e2e/vitest.e2e.devtools.config.ts', 'e2e/ide/platform-host.runtime.test.ts'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: createConsumerRuntimeEnvironment(provider, host, 'WEAPP_VITE_E2E_PLATFORM_PROJECT', root),
    })
  }
}
