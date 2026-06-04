import type { MutableCompilerContext } from '../../context'
import type { ManagedTsconfigFile } from './types'
import { fs } from '@weapp-core/shared/fs'
import { parse as parseJson } from 'comment-json'
import path from 'pathe'
import { createAppTsconfig, createNodeTsconfig, createServerTsconfig, createSharedTsconfig } from './configs'
import { getLegacyManagedTypeScriptConfig, resolveManagedDir, toJson } from './shared'

export type { ManagedTsconfigFile } from './types'

export async function createManagedTsconfigFiles(ctx: MutableCompilerContext): Promise<ManagedTsconfigFile[]> {
  const managedDir = resolveManagedDir(ctx)
  const legacyConfig = await getLegacyManagedTypeScriptConfig(ctx)
  const sharedPath = path.join(managedDir, 'tsconfig.shared.json')
  const appPath = path.join(managedDir, 'tsconfig.app.json')
  const nodePath = path.join(managedDir, 'tsconfig.node.json')
  const serverPath = path.join(managedDir, 'tsconfig.server.json')
  const sharedEmptyPath = path.join(managedDir, 'tsconfig.shared.empty.d.ts')

  return [
    {
      path: sharedEmptyPath,
      content: 'export {}\n',
    },
    {
      path: sharedPath,
      content: toJson(createSharedTsconfig(ctx, legacyConfig)),
    },
    {
      path: appPath,
      content: toJson(createAppTsconfig(ctx, legacyConfig)),
    },
    {
      path: nodePath,
      content: toJson(createNodeTsconfig(ctx, legacyConfig)),
    },
    {
      path: serverPath,
      content: toJson(createServerTsconfig(ctx, legacyConfig)),
    },
  ]
}

function createManagedRootTsconfig() {
  return toJson({
    references: [
      {
        path: './.weapp-vite/tsconfig.app.json',
      },
      {
        path: './.weapp-vite/tsconfig.server.json',
      },
      {
        path: './.weapp-vite/tsconfig.node.json',
      },
      {
        path: './.weapp-vite/tsconfig.shared.json',
      },
    ],
    files: [],
  })
}

async function hasManagedTsconfigChanges(ctx: MutableCompilerContext) {
  const files = await createManagedTsconfigFiles(ctx)

  for (const file of files) {
    const existing = await fs.readFile(file.path, 'utf8').catch(() => undefined)
    if (existing !== file.content) {
      return true
    }
  }

  return false
}

async function outputFileIfChanged(file: ManagedTsconfigFile) {
  const existing = await fs.readFile(file.path, 'utf8').catch(() => undefined)
  if (existing === file.content) {
    return false
  }

  await fs.outputFile(file.path, file.content, 'utf8')
  return true
}

export async function syncManagedTsconfigFiles(ctx: MutableCompilerContext) {
  const changed = await hasManagedTsconfigChanges(ctx)
  for (const file of await createManagedTsconfigFiles(ctx)) {
    await outputFileIfChanged(file)
  }
  return changed
}

interface TsconfigReference {
  path: string
}

interface TsconfigBootstrapData {
  extends?: unknown
  references?: unknown
}

const MANAGED_TSCONFIG_MARKERS = [
  '.weapp-vite/tsconfig.app.json',
  '.weapp-vite/tsconfig.shared.json',
]

async function readTsconfigData(filePath: string): Promise<TsconfigBootstrapData | undefined> {
  const content = await fs.readFile(filePath, 'utf8').catch(() => undefined)
  if (!content) {
    return undefined
  }

  try {
    const parsed = parseJson(content, undefined, true)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as TsconfigBootstrapData
      : undefined
  }
  catch {
    return undefined
  }
}

function normalizeReferencePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '')
}

function getTsconfigReferences(data: TsconfigBootstrapData | undefined): TsconfigReference[] {
  const references = Array.isArray(data?.references) ? data.references : []
  return references.filter((reference): reference is TsconfigReference => {
    return Boolean(
      reference
      && typeof reference === 'object'
      && typeof (reference as TsconfigReference).path === 'string',
    )
  })
}

function resolveReferenceProjectRoot(baseDir: string, value: string) {
  const resolved = path.resolve(baseDir, value)
  return path.basename(resolved).endsWith('.json') ? path.dirname(resolved) : resolved
}

async function isManagedTsconfigProject(projectRoot: string) {
  const tsconfigPath = path.resolve(projectRoot, 'tsconfig.json')
  const data = await readTsconfigData(tsconfigPath)
  if (!data) {
    return false
  }

  if (typeof data.extends === 'string') {
    const normalizedExtends = normalizeReferencePath(data.extends)
    if (MANAGED_TSCONFIG_MARKERS.some(marker => normalizedExtends.includes(marker))) {
      return true
    }
  }

  return getTsconfigReferences(data).some((reference) => {
    const normalizedPath = normalizeReferencePath(reference.path)
    return MANAGED_TSCONFIG_MARKERS.some(marker => normalizedPath.includes(marker))
  })
}

async function findReferencingWorkspaceTsconfig(cwd: string) {
  const targetRoot = path.resolve(cwd)
  let current = path.dirname(targetRoot)

  while (current && current !== path.dirname(current)) {
    const tsconfigPath = path.join(current, 'tsconfig.json')
    const data = await readTsconfigData(tsconfigPath)
    const references = getTsconfigReferences(data)
    if (references.some(reference => resolveReferenceProjectRoot(current, reference.path) === targetRoot)) {
      return { root: current, references }
    }
    current = path.dirname(current)
  }

  return undefined
}

async function syncSingleProjectManagedTsconfigBootstrapFiles(cwd: string) {
  const packageJsonPath = path.resolve(cwd, 'package.json')
  const packageJson = await fs.readJson(packageJsonPath, { throws: false }).catch(() => undefined) ?? {}
  const bootstrapCtx = {
    configService: {
      cwd,
      configFilePath: undefined,
      packageJson,
      weappViteConfig: {},
    },
  } as MutableCompilerContext

  let changed = false
  const rootTsconfigPath = path.resolve(cwd, 'tsconfig.json')
  const rootJsconfigPath = path.resolve(cwd, 'jsconfig.json')
  const hasRootConfig = await fs.pathExists(rootTsconfigPath) || await fs.pathExists(rootJsconfigPath)
  if (!hasRootConfig) {
    await fs.outputFile(rootTsconfigPath, createManagedRootTsconfig(), 'utf8')
    changed = true
  }

  for (const file of await createManagedTsconfigFiles(bootstrapCtx)) {
    const existing = await fs.readFile(file.path, 'utf8').catch(() => undefined)
    if (existing != null) {
      continue
    }
    await fs.outputFile(file.path, file.content, 'utf8')
    changed = true
  }

  return changed
}

export async function syncManagedTsconfigBootstrapFiles(cwd: string) {
  let changed = await syncSingleProjectManagedTsconfigBootstrapFiles(cwd)
  const workspace = await findReferencingWorkspaceTsconfig(cwd)
  if (!workspace) {
    return changed
  }

  for (const reference of workspace.references) {
    const projectRoot = resolveReferenceProjectRoot(workspace.root, reference.path)
    if (projectRoot === path.resolve(cwd) || !await isManagedTsconfigProject(projectRoot)) {
      continue
    }

    changed = await syncSingleProjectManagedTsconfigBootstrapFiles(projectRoot) || changed
  }

  return changed
}
