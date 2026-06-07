import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const WRAPPER_ROOT = path.join(os.tmpdir(), 'weapp-ide-cli-automator-projects')

interface AutomatorProjectResolution {
  cleanup?: () => Promise<void>
  projectPath: string
  sourceProjectPath: string
}

function normalizeProjectRelativeRoot(rawRoot: unknown) {
  if (typeof rawRoot !== 'string') {
    return undefined
  }

  const normalized = rawRoot.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized === '.') {
    return undefined
  }
  if (normalized.split('/').includes('..')) {
    return undefined
  }
  return normalized
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function readJsonObject(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const value = JSON.parse(raw) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined
  }
  catch {
    return undefined
  }
}

async function writeJsonObject(filePath: string, value: Record<string, unknown>) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function copyProjectRoot(sourceProjectPath: string, wrapperProjectPath: string, relativeRoot: string) {
  const sourcePath = path.join(sourceProjectPath, relativeRoot)
  if (!await pathExists(sourcePath)) {
    return
  }

  await fs.cp(sourcePath, path.join(wrapperProjectPath, relativeRoot), {
    dereference: true,
    force: true,
    recursive: true,
  })
}

async function copyJsonConfigAsWrapper(sourcePath: string, targetPath: string, patch: Record<string, unknown>) {
  const source = await readJsonObject(sourcePath)
  if (!source) {
    return
  }

  await writeJsonObject(targetPath, {
    ...source,
    ...patch,
  })
}

async function ensureWrapperAppConfig(wrapperProjectPath: string) {
  const appConfigPath = path.join(wrapperProjectPath, 'app.json')
  const appConfig = await readJsonObject(appConfigPath)
  if (!appConfig) {
    return
  }

  await writeJsonObject(appConfigPath, {
    ...appConfig,
    subPackages: Array.isArray(appConfig.subPackages) ? appConfig.subPackages : [],
  })
}

/**
 * @description 为 DevTools automator 准备稳定的小程序根目录，避免打开瞬间跨 miniprogramRoot 读取 app.json 抖动。
 */
export async function resolveAutomatorProjectPath(projectPath: string): Promise<AutomatorProjectResolution> {
  const sourceProjectPath = path.resolve(projectPath)
  const projectConfig = await readJsonObject(path.join(sourceProjectPath, 'project.config.json'))
  const miniprogramRoot = normalizeProjectRelativeRoot(projectConfig?.miniprogramRoot)

  if (!miniprogramRoot) {
    return {
      projectPath: sourceProjectPath,
      sourceProjectPath,
    }
  }

  const distRoot = path.join(sourceProjectPath, miniprogramRoot)
  if (!await pathExists(path.join(distRoot, 'app.json'))) {
    return {
      projectPath: sourceProjectPath,
      sourceProjectPath,
    }
  }

  const wrapperHash = createHash('sha1')
    .update(sourceProjectPath)
    .update('\0')
    .update(path.resolve(distRoot))
    .digest('hex')
    .slice(0, 16)
  const wrapperProjectPath = path.join(WRAPPER_ROOT, wrapperHash)

  await fs.rm(wrapperProjectPath, { recursive: true, force: true })
  await fs.mkdir(wrapperProjectPath, { recursive: true })
  await fs.cp(distRoot, wrapperProjectPath, {
    dereference: true,
    force: true,
    recursive: true,
  })

  const pluginRoot = normalizeProjectRelativeRoot(projectConfig?.pluginRoot)
  if (pluginRoot) {
    await copyProjectRoot(sourceProjectPath, wrapperProjectPath, pluginRoot)
  }

  const rootPatch = {
    miniprogramRoot: './',
    srcMiniprogramRoot: './',
  }
  await copyJsonConfigAsWrapper(
    path.join(sourceProjectPath, 'project.config.json'),
    path.join(wrapperProjectPath, 'project.config.json'),
    rootPatch,
  )
  await copyJsonConfigAsWrapper(
    path.join(sourceProjectPath, 'project.private.config.json'),
    path.join(wrapperProjectPath, 'project.private.config.json'),
    rootPatch,
  )
  await ensureWrapperAppConfig(wrapperProjectPath)

  return {
    cleanup: async () => {
      await fs.rm(wrapperProjectPath, { recursive: true, force: true })
    },
    projectPath: wrapperProjectPath,
    sourceProjectPath,
  }
}
