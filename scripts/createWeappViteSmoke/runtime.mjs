import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { cleanupChildProcessHandles, formatCommand, tail, terminateProcess, waitForChildClose } from '../project-lifecycle.mjs'
import { createCommandProcess } from './process.mjs'
import { isFilePresent, outputDirectory } from './templates.mjs'

const DEV_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_DEV_TIMEOUT_MS || 3 * 60 * 1000)
const DEV_SETTLE_MS = Number(process.env.CREATE_WEAPP_VITE_DEV_SETTLE_MS || 3 * 1000)
const UPDATE_TIMEOUT_MS = Number(process.env.CREATE_WEAPP_VITE_UPDATE_TIMEOUT_MS || 60 * 1000)

async function distHasRequiredOutputs(projectDir, templateName) {
  const requiredFiles = [
    path.join(projectDir, outputDirectory(templateName), 'app.json'),
    path.join(projectDir, outputDirectory(templateName), 'app.js'),
  ]
  const checks = await Promise.all(requiredFiles.map(isFilePresent))
  return checks.every(Boolean)
}

async function findExistingFile(paths) {
  for (const file of paths) {
    try {
      await fs.access(file)
      return file
    }
    catch {
      continue
    }
  }
  return null
}

/** 改变应用标题，避免仅修改注释被编译器消除后误判 HMR 失败。 */
export function changeAppTitle(source, extension, title) {
  if (extension === '.json') {
    const config = JSON.parse(source)
    config.window = { ...config.window, navigationBarTitleText: title }
    return `${JSON.stringify(config, null, 2)}\n`
  }
  const changed = source.replace(/(\bnavigationBarTitleText\s*:\s*)(?:'[^'\r\n]*'|"[^"\r\n]*")/, `$1${JSON.stringify(title)}`)
  if (changed === source) {
    throw new Error('Missing static navigationBarTitleText in the SFC app configuration')
  }
  return changed
}

/** 以产物内容确认更新，旧成功日志或无关文件的 mtime 不能作为通过条件。 */
export async function waitForAppTitle(file, title, timeoutMs, pollIntervalMs = 500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const config = JSON.parse(await fs.readFile(file, 'utf8'))
      if (config.window?.navigationBarTitleText === title) {
        return Date.now() - startedAt
      }
    }
    catch {
      // noop
    }

    await delay(pollIntervalMs)
  }

  throw new Error(`Timed out waiting for updated app title: ${file}`)
}

async function measureDevUpdate(projectDir, templateName) {
  const sourceFile = await findExistingFile([
    path.join(projectDir, 'src/app.json'),
    path.join(projectDir, 'src/app.vue'),
  ])
  const distFile = path.join(projectDir, outputDirectory(templateName), 'app.json')

  if (!sourceFile || !await isFilePresent(distFile)) {
    throw new Error('Missing source/dist file for dev update measurement')
  }

  const original = await fs.readFile(sourceFile, 'utf8')
  const title = `smoke-${Date.now()}`

  try {
    await fs.writeFile(sourceFile, changeAppTitle(original, path.extname(sourceFile), title), 'utf8')
    return await waitForAppTitle(distFile, title, UPDATE_TIMEOUT_MS)
  }
  finally {
    await fs.writeFile(sourceFile, original, 'utf8')
  }
}

async function runDevSmoke(projectDir, label, devCommand, templateName, env) {
  await fs.rm(path.join(projectDir, outputDirectory(templateName)), { recursive: true, force: true })

  console.log(`\n[${label}] ${formatCommand(devCommand.command, devCommand.args)}`)

  const stdoutChunks = []
  const stderrChunks = []
  const child = createCommandProcess(devCommand.command, devCommand.args, {
    cwd: projectDir,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let closed = false
  let launchError
  child.once('close', () => {
    closed = true
  })
  child.once('error', (error) => {
    launchError = error
  })

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    stdoutChunks.push(text)
    process.stdout.write(text)
  })

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderrChunks.push(text)
    process.stderr.write(text)
  })

  const start = Date.now()
  try {
    while (true) {
      if (launchError) {
        throw launchError
      }
      if (child.exitCode !== null) {
        throw new Error(
          [
            `[${label}] dev command exited before outputs were ready with code ${child.exitCode}`,
            tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
            tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
          ].filter(Boolean).join('\n\n'),
        )
      }

      if (await distHasRequiredOutputs(projectDir, templateName)) {
        const readyMs = Date.now() - start
        await delay(DEV_SETTLE_MS)
        if (child.exitCode !== null) {
          throw new Error(
            [
              `[${label}] dev command exited during settle window with code ${child.exitCode}`,
              tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
              tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
            ].filter(Boolean).join('\n\n'),
          )
        }
        const updateMs = await measureDevUpdate(projectDir, templateName)
        return {
          readyMs,
          updateMs,
        }
      }

      if (Date.now() - start > DEV_TIMEOUT_MS) {
        throw new Error(
          [
            `[${label}] Timed out waiting for dev outputs after ${DEV_TIMEOUT_MS}ms`,
            tail(stdoutChunks.join('')) ? `stdout:\n${tail(stdoutChunks.join(''))}` : '',
            tail(stderrChunks.join('')) ? `stderr:\n${tail(stderrChunks.join(''))}` : '',
          ].filter(Boolean).join('\n\n'),
        )
      }

      await delay(1000)
    }
  }
  finally {
    await terminateProcess(child)
    closed ||= await waitForChildClose(child)
    if (!closed) {
      console.warn(`[${label}] dev command did not fully close after termination; forcing stdio cleanup`)
      cleanupChildProcessHandles(child)
    }
  }
}

export { runDevSmoke }
