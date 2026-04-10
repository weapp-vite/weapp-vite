import type { MutableCompilerContext } from '../../context'
import type { ManagedTsconfigFile } from './types'
import { fs } from '@weapp-core/shared'
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

  return [
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

export async function syncManagedTsconfigFiles(ctx: MutableCompilerContext) {
  const changed = await hasManagedTsconfigChanges(ctx)
  for (const file of await createManagedTsconfigFiles(ctx)) {
    await fs.outputFile(file.path, file.content, 'utf8')
  }
  return changed
}

export async function syncManagedTsconfigBootstrapFiles(cwd: string) {
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
