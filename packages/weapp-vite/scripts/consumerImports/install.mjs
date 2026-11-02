import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 与现有 tarball 消费入口共用跨平台 npm 启动语义。
import { execa } from 'execa'
import { readPackedPackageJsonFromTarball } from '../../../../scripts/print-rolldown-versions.mjs'
import { createConsumerTemporaryRoot, packConsumerTarballs, readConsumerTarballs, verifyConsumerTarballProvenance } from '../consumerTarballs.mjs'
import { resolveConsumerToolchain } from '../consumerToolchains.mjs'
import { importsConsumerEnvironment } from './environment.mjs'

const toolchain = process.argv[2] ?? 'vite'
assert(['wv', 'vite', 'vite-plus'].includes(toolchain))
const runtime = process.argv[3]
assert(runtime === undefined || ['headless', 'devtools', 'both'].includes(runtime))
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const temporaryRoot = await createConsumerTemporaryRoot()
const root = path.join(temporaryRoot, 'consumer')
let completed = false
try {
  await mkdir(root)
  const packedDirectory = process.env.WEAPP_VITE_CONSUMER_TARBALLS
  const candidates = packedDirectory
    ? await readConsumerTarballs(packedDirectory, ['weapp-vite', 'wevu'])
    : await packConsumerTarballs(repoRoot, temporaryRoot, ['weapp-vite', 'wevu'])
  const selection = resolveConsumerToolchain(toolchain, readPackedPackageJsonFromTarball(candidates['weapp-vite'].slice(5)))
  await writeFile(path.join(root, 'package.json'), `${JSON.stringify({
    name: `weapp-vite-host-${toolchain}-imports`,
    private: true,
    type: 'module',
    dependencies: { ...candidates, ...selection.dependencies },
    overrides: selection.overrides,
  }, null, 2)}\n`)
  await execa('npm', ['install', '--strict-peer-deps'], {
    cwd: root,
    env: { ...importsConsumerEnvironment(), npm_config_legacy_peer_deps: 'false', npm_config_force: 'false', npm_config_ignore_scripts: 'false', npm_config_engine_strict: 'true' },
    extendEnv: false,
    stdio: 'inherit',
  })
  await verifyConsumerTarballProvenance(root, candidates)
  await execa(process.execPath, [fileURLToPath(new URL('./run.mjs', import.meta.url)), root, toolchain], { cwd: repoRoot, env: { ...importsConsumerEnvironment(), ...runtime ? { WEAPP_VITE_IMPORTS_RUNTIME: runtime } : {} }, extendEnv: false, stdio: 'inherit' })
  completed = true
}
finally {
  if (!completed || process.env.WEAPP_VITE_CONSUMER_KEEP === '1') {
    // 失败可能包含未终结的 IDE 资源，只有整条验证成功才自动移除关联目录。
    console.log(`Retained isolated consumer${completed ? '' : ' after incomplete verification'}: ${root}`)
  }
  else {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
