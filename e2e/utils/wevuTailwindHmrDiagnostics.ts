import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import { appendIdeReportEvent, resolveReportProjectPath } from './ideWarningReport'
import { resolveRuntimeProviderName } from './runtimeProvider'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function errorSummary(error: unknown) {
  const record = asRecord(error)
  return {
    name: error instanceof Error ? error.name : typeof error,
    code: typeof record.code === 'string' ? record.code : undefined,
  }
}

async function readConfig(file: string) {
  return asRecord(JSON.parse(await fs.readFile(file, 'utf8')))
}

async function snapshotFile(label: string, file: string) {
  try {
    const [bytes, stat] = await Promise.all([fs.readFile(file), fs.lstat(file)])
    const source = bytes.toString('utf8')
    return {
      label,
      path: resolveReportProjectPath(file),
      capturedAt: new Date().toISOString(),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      ctimeMs: stat.ctimeMs,
      ino: stat.ino,
      symbolicLink: stat.isSymbolicLink(),
      backgroundToken: source.match(/data-e2e-bg="([^"]*)"/)?.[1] ?? null,
      backgroundColors: [...new Set(Array.from(source.matchAll(/background-color:\s*(#[a-f\d]{6})\b/gi), match => match[1]))].slice(0, 12),
      probeTag: source.match(/<view\b[^>]+\bid="wevu-tailwind-hmr-probe"[^>]*>/)?.[0].slice(0, 600) ?? null,
    }
  }
  catch (error) {
    return { label, path: resolveReportProjectPath(file), error: errorSummary(error) }
  }
}

/** 仅读取当前会话的源文件与真实镜像，不触发编译、导航或文件写入。 */
export function createWevuTailwindHmrFileDiagnostics(session: object, fixtureRoot: string, route: string) {
  const metadata = asRecord(Reflect.get(session, '__WEAPP_VITE_SESSION_METADATA'))
  const wrapperProject = typeof metadata.projectPath === 'string' ? metadata.projectPath : undefined
  const distRoot = path.join(fixtureRoot, 'dist')
  const relativePage = route.replace(/^\/+/, '').split(/[?#]/, 1)[0]!

  async function capture(label: string) {
    const startedAt = new Date().toISOString()
    const files: Array<[string, string]> = [
      ['source', path.join(fixtureRoot, `src/${relativePage}.vue`)],
      ['dist:wxml', path.join(distRoot, `${relativePage}.wxml`)],
      ['dist:wxss', path.join(distRoot, `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`)],
    ]
    let wrapper: Record<string, unknown> = { error: 'session metadata has no projectPath' }
    if (wrapperProject) {
      try {
        const publicConfig = await readConfig(path.join(wrapperProject, 'project.config.json'))
        let privateConfig: Record<string, unknown> = {}
        try {
          privateConfig = await readConfig(path.join(wrapperProject, 'project.private.config.json'))
        }
        catch (error) {
          if (asRecord(error).code !== 'ENOENT') {
            throw error
          }
        }
        const configuredRoot = privateConfig.miniprogramRoot ?? publicConfig.miniprogramRoot
        const runtimeRoot = path.resolve(wrapperProject, typeof configuredRoot === 'string' ? configuredRoot : '.')
        wrapper = {
          project: resolveReportProjectPath(wrapperProject),
          runtimeRoot: resolveReportProjectPath(runtimeRoot),
          publicHotReload: asRecord(publicConfig.setting).compileHotReLoad,
          privateHotReload: asRecord(privateConfig.setting).compileHotReLoad,
        }
        files.push(
          ['wrapper:wxml', path.join(runtimeRoot, `${relativePage}.wxml`)],
          ['wrapper:wxss', path.join(runtimeRoot, `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`)],
        )
      }
      catch (error) {
        wrapper = { project: resolveReportProjectPath(wrapperProject), error: errorSummary(error) }
      }
    }
    const text = JSON.stringify({
      label,
      startedAt,
      provider: resolveRuntimeProviderName(),
      route,
      wrapper,
      files: await Promise.all(files.map(([name, file]) => snapshotFile(name, file))),
    })
    appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-files', project: resolveReportProjectPath(fixtureRoot), label, text })
    process.stdout.write(`[hmr-files] ${text}\n`)
  }

  return {
    capture: async (label: string) => {
      try {
        await capture(label)
      }
      catch (error) {
        process.stdout.write(`[hmr-files] ${JSON.stringify({ label, error: errorSummary(error) })}\n`)
      }
    },
  }
}
