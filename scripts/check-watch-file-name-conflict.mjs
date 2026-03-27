#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const READY_MARKER = '开发服务已就绪'
const REBUILD_MARKER = '小程序已重新构建'
const CONFLICT_MARKER = '[FILE_NAME_CONFLICT]'
const CONFIG_IMPORT_RE = /from ['"]weapp-vite\/config['"]/g
const NODE_MODULES_RE = /[\\/]node_modules(?:[\\/]|$)/

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function rejectAfter(timeoutMs, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs)
  })
}

async function waitForCondition(check, timeoutMs, message) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = check()
    if (result) {
      return result
    }
    await wait(100)
  }
  throw new Error(message)
}

async function patchTemplateConfigSource(root) {
  const configPath = path.join(root, 'vite.config.ts')
  const configContent = await fs.readFile(configPath, 'utf8')
  const workspaceRoot = path.resolve(import.meta.dirname, '..')
  const configEntry = pathToFileURL(path.join(workspaceRoot, 'packages/weapp-vite/src/config.ts')).href
  const sourcePatched = configContent.replace(CONFIG_IMPORT_RE, `from '${configEntry}'`)
  if (sourcePatched === configContent) {
    throw new Error('Expected weapp-vite/config import not found in template config')
  }
  const injected = sourcePatched.replace(
    '      plugins: [',
    [
      '      build: {',
      '        watch: {',
      '          chokidar: {',
      '            usePolling: true,',
      '            interval: 100,',
      '          },',
      '        },',
      '      },',
      '      plugins: [',
    ].join('\n'),
  )
  await fs.writeFile(configPath, injected, 'utf8')
}

async function ensureWorkspacePackageNodeModules() {
  const workspaceRoot = path.resolve(import.meta.dirname, '..')
  const rootNodeModules = path.join(workspaceRoot, 'node_modules')
  const packageNodeModules = path.join(workspaceRoot, 'packages/weapp-vite/node_modules')
  const rootWeappCore = path.join(rootNodeModules, '@weapp-core')
  const packageScopedNodeModules = path.join(packageNodeModules, '@weapp-core')
  const loggerEntry = path.join(packageScopedNodeModules, 'logger')

  try {
    await fs.access(loggerEntry)
    return
  }
  catch {
  }

  await fs.mkdir(packageNodeModules, { recursive: true })
  await fs.rm(packageScopedNodeModules, { recursive: true, force: true })
  await fs.symlink(rootWeappCore, packageScopedNodeModules, 'dir')
}

async function createTempProject() {
  const workspaceRoot = path.resolve(import.meta.dirname, '..')
  const fixtureSource = path.join(workspaceRoot, 'templates/weapp-vite-template')
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-watch-conflict-'))
  await fs.cp(fixtureSource, tempRoot, {
    recursive: true,
    dereference: true,
    filter: src => !NODE_MODULES_RE.test(src),
  })
  await fs.symlink(path.join(workspaceRoot, 'node_modules'), path.join(tempRoot, 'node_modules'), 'dir')
  await patchTemplateConfigSource(tempRoot)
  return tempRoot
}

async function updateFile(root, relativeFile, mode) {
  const filePath = path.join(root, relativeFile)
  if (mode === 'touch-existing') {
    const stat = await fs.stat(filePath)
    const nextTime = new Date(Math.max(Date.now(), stat.mtimeMs + 1000))
    await fs.utimes(filePath, nextTime, nextTime)
    return
  }

  await fs.writeFile(filePath, '', 'utf8')
}

async function main() {
  await ensureWorkspacePackageNodeModules()
  const tempRoot = await createTempProject()
  const output = []
  let rebuildCount = 0
  let ready = false
  let exiting = false

  const child = spawn('pnpm', ['dev'], {
    cwd: tempRoot,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const collect = (chunk) => {
    const text = chunk.toString('utf8')
    output.push(text)
    if (text.includes(READY_MARKER)) {
      ready = true
    }
    rebuildCount += text.split(REBUILD_MARKER).length - 1
  }

  child.stdout.on('data', collect)
  child.stderr.on('data', collect)

  const closePromise = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (exiting) {
        resolve({ code, signal })
        return
      }
      reject(new Error(`watch process exited unexpectedly: code=${code} signal=${signal}\n\n${output.join('')}`))
    })
  })

  try {
    await Promise.race([
      waitForCondition(() => ready, 30_000, 'watch dev server did not become ready in time'),
      closePromise,
    ])

    const changePlan = [
      { relativeFile: 'src/pages/index/index.wxml', mode: 'touch-existing' },
      { relativeFile: 'src/pages/index/index.ts', mode: 'touch-existing' },
      { relativeFile: 'src/app.scss', mode: 'touch-existing' },
      { relativeFile: 'src/pages/index/index.wxml', mode: 'touch-existing' },
    ]

    for (const step of changePlan) {
      const previousRebuildCount = rebuildCount
      await updateFile(tempRoot, step.relativeFile, step.mode)
      await Promise.race([
        waitForCondition(
          () => rebuildCount > previousRebuildCount,
          30_000,
          `watch rebuild did not complete after ${step.relativeFile}`,
        ),
        closePromise,
      ])
    }

    const text = output.join('')
    if (text.includes(CONFLICT_MARKER)) {
      throw new Error(`detected ${CONFLICT_MARKER} in watch output`)
    }
  }
  finally {
    exiting = true
    child.kill('SIGINT')
    await Promise.race([
      closePromise.catch(() => undefined),
      rejectAfter(5_000, 'watch process did not exit in time').catch(() => undefined),
    ])
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
}

await main()
