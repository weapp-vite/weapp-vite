import { randomUUID } from 'node:crypto'
import { open, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 只在原配置旁创建本次拥有的包装文件，保留 factory/env、插件数组和原配置字节。 */
export async function createSiblingPluginConfig({ directory, configFiles, pluginUrl, pluginExport, pluginOptions, mergeUrl }) {
  if (!/^[A-Z_$][\w$]*$/i.test(pluginExport)) {
    throw new Error('Config wrapper requires a valid plugin export name')
  }
  if (configFiles.length > 1 && !mergeUrl) {
    throw new Error('Multiple original configs require the existing config merge implementation')
  }
  const configFile = path.join(directory, `.weapp-vite-e2e-${randomUUID()}.config.mjs`)
  const imports = configFiles.map((file, index) => `import original${index} from ${JSON.stringify(pathToFileURL(file).href)}`)
  imports.push(`import { ${pluginExport} } from ${JSON.stringify(pluginUrl)}`)
  if (configFiles.length > 1) {
    imports.push(`import { defu } from ${JSON.stringify(mergeUrl)}`)
  }
  const resolutions = configFiles.map((_, index) => `  const config${index} = await resolveOriginal(original${index}, env)`)
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
${resolutions.join('\n')}
  const config = ${configExpression}
  return { ...config, plugins: [${pluginExport}(${JSON.stringify(pluginOptions)}), ...(config.plugins ?? [])] }
}
`
  let disposing
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
    return { configFile, dispose }
  }
  catch (error) {
    try {
      await dispose()
    }
    catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Config wrapper preparation and disposal failed', { cause: error })
    }
    throw error
  }
}
