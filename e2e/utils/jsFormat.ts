import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export type TestJsFormat = 'cjs' | 'esm'

const WEAPP_CONFIG_CANDIDATES = [
  'weapp-vite.config.ts',
  'weapp-vite.config.mts',
  'weapp-vite.config.cts',
  'weapp-vite.config.js',
  'weapp-vite.config.mjs',
  'weapp-vite.config.cjs',
  'weapp-vite.config.json',
]

const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
]

async function findConfigFile(projectRoot: string) {
  for (const fileName of [...WEAPP_CONFIG_CANDIDATES, ...VITE_CONFIG_CANDIDATES]) {
    const candidatePath = path.resolve(projectRoot, fileName)
    try {
      await fs.access(candidatePath)
      return candidatePath
    }
    catch {
      continue
    }
  }

  return undefined
}

function renderConfigOverride(jsFormat: TestJsFormat, configFile?: string) {
  if (!configFile) {
    return [
      `import { defineConfig } from 'weapp-vite/config'`,
      ``,
      `export default defineConfig({`,
      `  weapp: {`,
      `    jsFormat: '${jsFormat}',`,
      `  },`,
      `})`,
      ``,
    ].join('\n')
  }

  const configImportUrl = pathToFileURL(configFile).href
  return [
    `import { mergeConfig } from 'vite'`,
    `import { defineConfig } from 'weapp-vite/config'`,
    `import * as importedConfigModule from '${configImportUrl}'`,
    ``,
    `const importedConfig = 'default' in importedConfigModule ? importedConfigModule.default : importedConfigModule`,
    `const jsFormatOverride = defineConfig({`,
    `  weapp: {`,
    `    jsFormat: '${jsFormat}',`,
    `  },`,
    `})`,
    ``,
    `function applyOverride(config) {`,
    `  return mergeConfig(config ?? {}, jsFormatOverride)`,
    `}`,
    ``,
    `export default defineConfig(async (env) => {`,
    `  const resolvedConfig = typeof importedConfig === 'function'`,
    `    ? await importedConfig(env)`,
    `    : await importedConfig`,
    ``,
    `  return applyOverride(resolvedConfig)`,
    `})`,
    ``,
  ].join('\n')
}

export interface ResolveJsFormatConfigOptions {
  configFile?: string
  jsFormat?: TestJsFormat
  projectRoot: string
}

/**
 * @description 为 e2e / template 测试生成临时配置包装层，避免直接改 fixture 源文件。
 */
export async function resolveJsFormatConfigOverride(options: ResolveJsFormatConfigOptions) {
  const {
    projectRoot,
    jsFormat,
    configFile,
  } = options

  if (!jsFormat) {
    return {
      cleanup: async () => {},
      configFile,
    }
  }

  const resolvedConfigFile = configFile
    ? path.resolve(projectRoot, configFile)
    : await findConfigFile(projectRoot)

  const tempRoot = await fs.mkdtemp(path.join(projectRoot, '.weapp-vite-test-config-'))
  const tempConfigFile = path.join(tempRoot, `vite.config.${jsFormat}.ts`)
  await fs.writeFile(tempConfigFile, renderConfigOverride(jsFormat, resolvedConfigFile), 'utf8')

  return {
    cleanup: async () => {
      await fs.rm(tempRoot, { recursive: true, force: true })
    },
    configFile: tempConfigFile,
  }
}
