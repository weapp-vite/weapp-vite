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

function createWrapperProjectConfig(source: Record<string, unknown>, patch: Record<string, unknown>) {
  const {
    miniprogramRoot: _miniprogramRoot,
    qcloudRoot: _qcloudRoot,
    srcMiniprogramRoot: _srcMiniprogramRoot,
    ...rest
  } = source
  const sourceSetting = source.setting && typeof source.setting === 'object'
    ? source.setting as Record<string, unknown>
    : {}
  const patchSetting = patch.setting && typeof patch.setting === 'object'
    ? patch.setting as Record<string, unknown>
    : {}

  return {
    ...rest,
    ...patch,
    setting: {
      ...sourceSetting,
      ...patchSetting,
      packNpmManually: false,
      packNpmRelationList: [],
    },
  }
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

export interface AutomatorProjectPlan {
  sourceProjectPath: string
  distRoot: string
  projectConfig: Record<string, unknown>
}

/** 只读解析布局，受管路径必须先通过窗口预算再创建快照。 */
export async function readAutomatorProjectPlan(projectPath: string): Promise<AutomatorProjectPlan | undefined> {
  const sourceProjectPath = path.resolve(projectPath)
  const projectConfig = await readJsonObject(path.join(sourceProjectPath, 'project.config.json'))
  const miniprogramRoot = normalizeProjectRelativeRoot(projectConfig?.miniprogramRoot)
  if (!miniprogramRoot) {
    return
  }
  const distRoot = path.join(sourceProjectPath, miniprogramRoot)
  if (!await pathExists(path.join(distRoot, 'app.json'))) {
    return
  }
  return { sourceProjectPath, distRoot, projectConfig: projectConfig ?? {} }
}

/** 仅转换已分配快照的布局；目录所有权与删除由调用方持有。 */
export async function populateAutomatorProjectSnapshot(plan: AutomatorProjectPlan, wrapperProjectPath: string) {
  const { sourceProjectPath, distRoot, projectConfig: sourceProjectConfig } = plan
  await fs.cp(distRoot, wrapperProjectPath, {
    dereference: true,
    force: true,
    recursive: true,
  })
  const pluginRoot = normalizeProjectRelativeRoot(sourceProjectConfig.pluginRoot)
  if (pluginRoot) {
    await copyProjectRoot(sourceProjectPath, wrapperProjectPath, pluginRoot)
  }
  const projectPrivateConfig = await readJsonObject(path.join(sourceProjectPath, 'project.private.config.json')) ?? {}
  await writeJsonObject(
    path.join(wrapperProjectPath, 'project.config.json'),
    createWrapperProjectConfig(sourceProjectConfig, {
      ...projectPrivateConfig,
      compileType: sourceProjectConfig.compileType === 'plugin' ? 'plugin' : 'miniprogram',
      miniprogramRoot: './',
      srcMiniprogramRoot: './',
    }),
  )
  await fs.rm(path.join(wrapperProjectPath, 'project.private.config.json'), { force: true })
  await ensureWrapperAppConfig(wrapperProjectPath)
}

/** 为普通非受管 automator 保留既有稳定项目路径合同。 */
export async function resolveAutomatorProjectPath(projectPath: string): Promise<AutomatorProjectResolution> {
  const sourceProjectPath = path.resolve(projectPath)
  const plan = await readAutomatorProjectPlan(sourceProjectPath)
  if (!plan) {
    return { projectPath: sourceProjectPath, sourceProjectPath }
  }
  const wrapperHash = createHash('sha1')
    .update(sourceProjectPath)
    .update('\0')
    .update(path.resolve(plan.distRoot))
    .digest('hex')
    .slice(0, 16)
  const wrapperProjectPath = path.join(WRAPPER_ROOT, wrapperHash)
  await fs.rm(wrapperProjectPath, { recursive: true, force: true })
  await fs.mkdir(wrapperProjectPath, { recursive: true })
  await populateAutomatorProjectSnapshot(plan, wrapperProjectPath)
  return {
    cleanup: async () => {
      await fs.rm(wrapperProjectPath, { recursive: true, force: true })
    },
    projectPath: wrapperProjectPath,
    sourceProjectPath,
  }
}
