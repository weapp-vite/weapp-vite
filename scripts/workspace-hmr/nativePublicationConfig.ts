import { randomUUID } from 'node:crypto'
import { access, open, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEFAULT_VITE_CONFIG_FILES } from '../../packages/weapp-vite/src/utils/loadViteConfigFile'
import { resolveWeappConfigFile } from '../../packages/weapp-vite/src/utils/weappConfig'

/** 复用默认配置发现与合并顺序，只给原配置增加既有的原生发布观察插件。 */
export async function createWorkspaceNativePublicationConfig(project: {
  root: string
  sourceRoot: string
}, profilePath: string) {
  let viteConfig: string | undefined
  for (const name of DEFAULT_VITE_CONFIG_FILES) {
    const file = path.join(project.root, name)
    try {
      await access(file)
      viteConfig = file
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  const weappConfig = await resolveWeappConfigFile({ root: project.root })
  const configFiles = [...new Set([viteConfig, weappConfig].filter((file): file is string => Boolean(file)))]
  const id = randomUUID()
  const configFile = path.join(path.dirname(configFiles.at(-1) ?? path.join(project.root, 'vite.config.mjs')), `.weapp-vite-e2e-${id}.config.mjs`)
  const imports = configFiles.map((file, index) => `import original${index} from ${JSON.stringify(pathToFileURL(file).href)}`)
  imports.push(`import { defu } from ${JSON.stringify(import.meta.resolve('@weapp-core/shared'))}`)
  imports.push(`import { createWorkspaceHmrProjectConfig } from ${JSON.stringify(new URL('./projectConfig.ts', import.meta.url).href)}`)
  const configExpression = configFiles.length > 1
    ? `defu(${configFiles.map((_, index) => `config${index}`).reverse().join(', ')})`
    : configFiles.length ? 'config0' : '{}'
  const source = `${imports.join('\n')}
async function resolveOriginal(original, env) {
  const config = await (typeof original === 'function' ? original(env) : original)
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Original Vite config must resolve to an object')
  }
  return config
}
export default async env => {
${configFiles.map((_, index) => `  const config${index} = await resolveOriginal(original${index}, env)`).join('\n')}
  return createWorkspaceHmrProjectConfig(${configExpression}, ${JSON.stringify({
    id,
    sourceRoot: path.relative(project.root, project.sourceRoot) || '.',
    profilePath,
  })})
}
`
  let disposing: Promise<void> | undefined
  const dispose = () => {
    disposing ??= rm(configFile, { force: true }).catch((error) => {
      disposing = undefined
      throw error
    })
    return disposing
  }
  const handle = await open(configFile, 'wx')
  try {
    try {
      await handle.writeFile(source)
    }
    finally {
      await handle.close()
    }
    return { id, configFile, dispose }
  }
  catch (error) {
    try {
      await dispose()
    }
    catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Workspace HMR config preparation and disposal failed', { cause: error })
    }
    throw error
  }
}
