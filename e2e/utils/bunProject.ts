/* eslint-disable e18e/ban-dependencies -- Bun CLI 回归使用 execa 运行真实子进程。 */
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { expect } from 'vitest'
import { createDevProcessEnv } from './dev-process-env'

const ROOT = path.resolve(import.meta.dirname, '../..')
export const BUN_EXECUTABLE = process.env.WEAPP_VITE_E2E_BUN_PATH || 'bun'

export async function createBunProject() {
  const parent = path.join(ROOT, '.tmp/e2e-projects')
  await mkdir(parent, { recursive: true })
  const project = await mkdtemp(path.join(parent, 'issue-1222-'))
  try {
    await cp(path.join(ROOT, 'e2e-apps/github-issues/fixtures/issue-1222'), project, { recursive: true })
    await rm(path.join(project, 'node_modules'), { recursive: true, force: true })
    await symlink(path.join(ROOT, 'e2e-apps/github-issues/node_modules'), path.join(project, 'node_modules'), 'junction')
    return project
  }
  catch (error) {
    await rm(project, { recursive: true, force: true })
    throw error
  }
}

export function runBunScript(project: string, script: 'build' | 'dev', runtime = 'classic') {
  const env = createDevProcessEnv()
  env.BUN_TEST_HMR_RUNTIME = runtime
  // 嵌套的原始复现命令也必须使用本轮指定的同一 Bun。
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') || 'PATH'
  if (path.isAbsolute(BUN_EXECUTABLE)) {
    env[pathKey] = `${path.dirname(BUN_EXECUTABLE)}${path.delimiter}${env[pathKey] || ''}`
  }
  return execa(BUN_EXECUTABLE, ['run', script], {
    cwd: project,
    env,
    extendEnv: false,
    stdin: 'pipe',
    all: true,
    reject: false,
    timeout: script === 'dev' ? 300_000 : 120_000,
    forceKillAfterDelay: 5_000,
  })
}

export async function readBunJavaScript(project: string) {
  const dist = path.join(project, 'dist')
  const files = await readdir(dist, { recursive: true })
  return (await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(path.join(dist, file), 'utf8')))).join('\n')
}

export async function expectBunOutputs(project: string, marker: string) {
  for (const file of ['app.js', 'app.json', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
    expect(await readFile(path.join(project, 'dist', file), 'utf8')).not.toBe('')
  }
  expect(await readBunJavaScript(project)).toContain(marker)
}

export async function requestBunShutdown(project: string, output: string) {
  const line = output.split(/\r?\n/).find(line => line.startsWith('BUN_RUNTIME '))
  if (!line) {
    throw new Error(`Bun CLI did not publish its owned PID:\n${output}`)
  }
  const runtime = JSON.parse(line.slice('BUN_RUNTIME '.length)) as { pid: number }
  if (!Number.isSafeInteger(runtime.pid) || runtime.pid <= 0) {
    throw new Error('Bun CLI published an invalid PID')
  }
  if (process.platform === 'win32') {
    await writeFile(path.join(project, 'shutdown-request'), 'SIGTERM\n')
  }
  else {
    process.kill(runtime.pid, 'SIGTERM')
  }
}

export async function updateBunPage(project: string) {
  const file = path.join(project, 'src/pages/index/index.js')
  await writeFile(file, (await readFile(file, 'utf8')).replaceAll('bun-initial', 'bun-updated'))
}
