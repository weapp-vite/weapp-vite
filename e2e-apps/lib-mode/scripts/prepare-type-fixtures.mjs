import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

const rootDir = path.resolve(import.meta.dirname, '..')
const cliPath = path.resolve(rootDir, '../../packages/weapp-vite/bin/weapp-vite.js')
const distDir = path.resolve(rootDir, 'dist')

/**
 * @description 将 dist 产物复制到目标目录，供 tsd 用例引用。
 */
async function copyDistTo(targetRelativePath) {
  const targetDir = path.resolve(rootDir, targetRelativePath)
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(path.dirname(targetDir), { recursive: true })
  await cp(distDir, targetDir, { recursive: true })
}

/**
 * @description 执行一次 lib-mode 构建，生成 tsd 所需的类型产物目录。
 */
async function runBuild(env = {}) {
  await execa('node', [cliPath, 'build', rootDir, '--platform', 'weapp'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  })
}

/**
 * @description 生成 test-d 引用的 dist-lib 产物。
 */
async function buildDistLib() {
  await runBuild()
  await copyDistTo('dist-lib')
}

/**
 * @description 生成 test-d 引用的 dist-lib-file 产物。
 */
async function buildDistLibFile() {
  await runBuild({
    WEAPP_LIB_FILE_NAME: 'lib/[name]',
  })
  await copyDistTo('dist-lib-file')
}

/**
 * @description 生成 test-d 引用的 dist-matrix 全量组合产物。
 */
async function buildDistMatrix() {
  await rm(path.resolve(rootDir, 'dist-matrix'), { recursive: true, force: true })
  const sharedStrategies = ['duplicate', 'hoist']
  const sharedModes = ['common', 'inline', 'path']

  for (const strategy of sharedStrategies) {
    for (const mode of sharedModes) {
      await runBuild({
        WEAPP_CHUNK_STRATEGY: strategy,
        WEAPP_CHUNK_MODE: mode,
      })
      await copyDistTo(`dist-matrix/${strategy}-${mode}`)
    }
  }
}

await buildDistLib()
await buildDistLibFile()
await buildDistMatrix()
