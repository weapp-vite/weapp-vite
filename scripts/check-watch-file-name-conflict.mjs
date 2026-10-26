#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const READY_MARKER = '开发服务已就绪'
const REBUILD_MARKER = '小程序已重新构建'
const CONFLICT_MARKER = '[FILE_NAME_CONFLICT]'
const DEV_READY_TIMEOUT_MS = 60_000
const REBUILD_TIMEOUT_MS = 30_000
const NODE_MODULES_RE = /[\\/]node_modules(?:[\\/]|$)/
const cliPath = path.join(path.dirname(createRequire(import.meta.url).resolve('weapp-vite/package.json')), 'bin', 'weapp-vite.js')

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

async function configureTemplateWatch(root) {
  const configPath = path.join(root, 'weapp-vite.config.ts')
  const configContent = await fs.readFile(configPath, 'utf8')
  const injected = configContent.replace(
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
  if (injected === configContent) {
    throw new Error('Expected plugin list not found in template config')
  }
  await fs.writeFile(configPath, injected, 'utf8')
}

async function createTempProject() {
  const workspaceRoot = path.resolve(import.meta.dirname, '..')
  const fixtureSource = path.join(workspaceRoot, 'templates/weapp-vite-template')
  const tempRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-watch-conflict-')))
  try {
    await fs.cp(fixtureSource, tempRoot, {
      recursive: true,
      dereference: true,
      filter: src => !NODE_MODULES_RE.test(src),
    })
    const manifest = JSON.parse(await fs.readFile(path.join(fixtureSource, 'package.json'), 'utf8'))
    // fixture 独占缓存与安装状态，只共享模板已安装依赖的公共入口。
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })) {
      const target = path.join(tempRoot, 'node_modules', name)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.symlink(await fs.realpath(path.join(fixtureSource, 'node_modules', name)), target, process.platform === 'win32' ? 'junction' : 'dir')
    }
    await configureTemplateWatch(tempRoot)
    return tempRoot
  }
  catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true })
    throw error
  }
}

async function runCommand(cwd, command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const output = []
    const timer = setTimeout(() => {
      child.kill('SIGINT')
      reject(new Error(`${command} ${args.join(' ')} timed out\n\n${output.join('')}`))
    }, timeoutMs)

    const collect = (chunk) => {
      output.push(chunk.toString('utf8'))
    }

    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(undefined)
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code=${code} signal=${signal}\n\n${output.join('')}`))
    })
  })
}

async function updateFile(root, relativeFile) {
  // 首构已消费的相同内容通知会被去重；使用合法内容编辑触发真实后续构建。
  await fs.appendFile(path.join(root, relativeFile), '\n', 'utf8')
}

async function main() {
  const tempRoot = await createTempProject()
  const output = []
  let rebuildCount = 0
  let ready = false
  let exiting = false

  const child = spawn(process.execPath, [cliPath, 'dev'], {
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
    await runCommand(tempRoot, process.execPath, [cliPath, 'prepare'])

    await Promise.race([
      waitForCondition(
        () => ready,
        DEV_READY_TIMEOUT_MS,
        `watch dev server did not become ready in time\n\n${output.join('')}`,
      ),
      closePromise,
    ])

    const changePlan = [
      { relativeFile: 'src/app.json' },
      { relativeFile: 'src/theme.json' },
      { relativeFile: 'src/sitemap.json' },
      { relativeFile: 'src/pages/index/index.wxml' },
      { relativeFile: 'src/pages/index/index.json' },
      { relativeFile: 'src/pages/index/index.ts' },
      { relativeFile: 'src/pages/index/index.scss' },
      { relativeFile: 'src/layouts/default/index.wxml' },
      { relativeFile: 'src/layouts/default/index.json' },
      { relativeFile: 'src/layouts/default/index.ts' },
      { relativeFile: 'src/layouts/default/index.scss' },
      { relativeFile: 'src/layouts/admin/index.wxml' },
      { relativeFile: 'src/layouts/admin/index.json' },
      { relativeFile: 'src/layouts/admin/index.ts' },
      { relativeFile: 'src/layouts/admin/index.scss' },
      { relativeFile: 'src/components/HelloWorld/HelloWorld.wxml' },
      { relativeFile: 'src/components/HelloWorld/HelloWorld.json' },
      { relativeFile: 'src/components/HelloWorld/HelloWorld.ts' },
      { relativeFile: 'src/components/HelloWorld/HelloWorld.scss' },
      { relativeFile: 'src/app.scss' },
    ]

    for (const step of changePlan) {
      const previousRebuildCount = rebuildCount
      await updateFile(tempRoot, step.relativeFile)
      await Promise.race([
        waitForCondition(
          () => rebuildCount > previousRebuildCount,
          REBUILD_TIMEOUT_MS,
          `watch rebuild did not complete after ${step.relativeFile}\n\n${output.join('')}`,
        ),
        closePromise,
      ])
      console.log(`[watch-conflict] rebuilt ${step.relativeFile}`)
    }

    const text = output.join('')
    if (text.includes(CONFLICT_MARKER)) {
      throw new Error(`detected ${CONFLICT_MARKER} in watch output`)
    }
    console.log(`[watch-conflict] passed ${changePlan.length} content edits without ${CONFLICT_MARKER}`)
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
