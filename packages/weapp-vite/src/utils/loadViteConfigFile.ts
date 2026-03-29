import type { ConfigEnv, ConfigLoader, ConfigRunner, UserConfigExport } from 'vite'
import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'pathe'
import { loadConfigFromFile } from 'vite'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMP_CONFIG_ARTIFACTS = new Set<string>()
let cleanupRegistered = false

const WORKSPACE_CONFIG_IMPORTS = new Map<string, string>([
  ['weapp-vite/json', path.resolve(PACKAGE_ROOT, 'dist/json.mjs')],
  ['weapp-vite/runtime', path.resolve(PACKAGE_ROOT, 'dist/runtime.mjs')],
  ['weapp-vite/mcp', path.resolve(PACKAGE_ROOT, 'dist/mcp.mjs')],
  ['weapp-vite/types', path.resolve(PACKAGE_ROOT, 'dist/types.mjs')],
  ['weapp-vite/auto-routes', path.resolve(PACKAGE_ROOT, 'dist/auto-routes.mjs')],
])

const CONFIG_SHIM_SOURCE = `export function defineConfig(config) {
  return config
}
`

const RESOLVERS_SHIM_SOURCE = `function createComponentResolver(defaultPrefix, resolveDefault, metadataResolver, staticComponents = {}) {
  return (options = {}) => {
    const prefix = options.prefix ?? defaultPrefix
    const resolve = options.resolve ?? resolveDefault
    const components = Object.freeze({ ...staticComponents })

    return {
      components,
      resolve(componentName) {
        const staticFrom = components[componentName]
        if (staticFrom) {
          return {
            name: componentName,
            from: staticFrom,
          }
        }
        if (!componentName.startsWith(prefix)) {
          return
        }
        const name = componentName.slice(prefix.length)
        if (!name) {
          return
        }
        const resolved = resolve({ name, prefix })
        return {
          name: componentName,
          from: resolved.value,
        }
      },
      resolveExternalMetadataCandidates: metadataResolver,
    }
  }
}

export const VantResolver = createComponentResolver(
  'van-',
  ({ name, prefix }) => ({
    key: \`\${prefix}\${name}\`,
    value: \`@vant/weapp/\${name}\`,
  }),
  (from) => {
    if (!from.startsWith('@vant/weapp/')) {
      return undefined
    }
    const component = from.slice('@vant/weapp/'.length)
    if (!component) {
      return undefined
    }
    return {
      packageName: '@vant/weapp',
      dts: [
        \`lib/\${component}/index.d.ts\`,
        \`dist/\${component}/index.d.ts\`,
      ],
      js: [
        \`lib/\${component}/index.js\`,
        \`dist/\${component}/index.js\`,
      ],
    }
  },
  {
    'van-button': '@vant/weapp/button',
  },
)

export const TDesignResolver = createComponentResolver(
  't-',
  ({ name, prefix }) => ({
    key: \`\${prefix}\${name}\`,
    value: \`tdesign-miniprogram/\${name}/\${name}\`,
  }),
  (from) => {
    if (!from.startsWith('tdesign-miniprogram/')) {
      return undefined
    }
    const relative = from.slice('tdesign-miniprogram/'.length)
    const segments = relative.split('/').filter(Boolean)
    const componentDir = segments[0]
    const fileBase = segments.at(-1)
    if (!componentDir || !fileBase) {
      return undefined
    }
    const baseDir = \`miniprogram_dist/\${componentDir}\`
    const base = \`\${baseDir}/\${fileBase}\`
    return {
      packageName: 'tdesign-miniprogram',
      dts: [
        \`\${baseDir}/type.d.ts\`,
        \`\${baseDir}/props.d.ts\`,
        \`\${base}.d.ts\`,
        \`\${baseDir}/index.d.ts\`,
      ],
      js: [
        \`\${baseDir}/type.js\`,
        \`\${baseDir}/props.js\`,
        \`\${base}.js\`,
        \`\${baseDir}/index.js\`,
      ],
    }
  },
)

export const WeuiResolver = createComponentResolver(
  'mp-',
  ({ name, prefix }) => ({
    key: \`\${prefix}\${name}\`,
    value: \`weui-miniprogram/\${name}/\${name}\`,
  }),
)
`

const DEFAULT_VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
]
function cleanupTempConfigArtifactsSync() {
  for (const file of TEMP_CONFIG_ARTIFACTS) {
    try {
      fsSync.rmSync(file, { force: true })
    }
    catch {
      continue
    }
  }
  TEMP_CONFIG_ARTIFACTS.clear()
}

function scheduleTempConfigArtifactsCleanup(files: Iterable<string>) {
  const serializedFiles = Array.from(new Set(files))
  if (serializedFiles.length === 0) {
    return
  }
  const cleanupScript = `
    const fs = require('node:fs')
    const files = process.argv.slice(1)
    setTimeout(() => {
      for (const file of files) {
        try {
          fs.rmSync(file, { force: true })
        }
        catch {}
      }
    }, 5000)
  `
  const cleanupProcess = spawn(
    process.execPath,
    ['-e', cleanupScript, ...serializedFiles],
    {
      detached: true,
      stdio: 'ignore',
    },
  )
  cleanupProcess.unref()
}

function ensureTempConfigCleanupRegistered() {
  if (cleanupRegistered) {
    return
  }
  cleanupRegistered = true
  process.once('exit', cleanupTempConfigArtifactsSync)
}

async function resolveImplicitConfigFile(configRoot: string) {
  for (const fileName of DEFAULT_VITE_CONFIG_FILES) {
    const filePath = path.resolve(configRoot, fileName)
    try {
      await fs.access(filePath)
      return filePath
    }
    catch {
      continue
    }
  }
  return undefined
}

function rewriteWorkspaceImports(source: string, replacements: Map<string, string>) {
  let rewritten = source
  let changed = false

  for (const [specifier, replacement] of replacements) {
    if (!rewritten.includes(specifier)) {
      continue
    }
    changed = true
    rewritten = rewritten
      .replaceAll(`'${specifier}'`, `'${replacement}'`)
      .replaceAll(`"${specifier}"`, `"${replacement}"`)
  }

  return {
    changed,
    source: rewritten,
  }
}

async function createWorkspaceImportReplacements(
  configFile: string,
  source: string,
  nonce: string,
) {
  const replacements = new Map<string, string>()
  const createdFiles: string[] = []

  if (source.includes('weapp-vite/config')) {
    const configShimPath = path.join(
      path.dirname(configFile),
      `.weapp-vite-config-shim-${nonce}.mjs`,
    )
    await fs.writeFile(configShimPath, CONFIG_SHIM_SOURCE)
    createdFiles.push(configShimPath)
    replacements.set('weapp-vite/config', `./${path.basename(configShimPath)}`)
  }

  if (source.includes('weapp-vite/auto-import-components/resolvers')) {
    const resolversShimPath = path.join(
      path.dirname(configFile),
      `.weapp-vite-resolvers-shim-${nonce}.mjs`,
    )
    await fs.writeFile(resolversShimPath, RESOLVERS_SHIM_SOURCE)
    createdFiles.push(resolversShimPath)
    replacements.set('weapp-vite/auto-import-components/resolvers', `./${path.basename(resolversShimPath)}`)
  }

  for (const [specifier, replacement] of WORKSPACE_CONFIG_IMPORTS) {
    if (!source.includes(specifier)) {
      continue
    }
    replacements.set(specifier, replacement)
  }

  return {
    createdFiles,
    replacements,
  }
}

function normalizeLoadedResult(
  loaded: Awaited<ReturnType<typeof loadConfigFromFile>>,
  originalPath: string,
  tempPath: string,
) {
  if (!loaded) {
    return loaded
  }

  const dependencies = new Set<string>()
  for (const dependency of loaded.dependencies ?? []) {
    dependencies.add(path.resolve(dependency) === path.resolve(tempPath) ? originalPath : dependency)
  }
  dependencies.add(originalPath)

  return {
    ...loaded,
    path: path.resolve(loaded.path) === path.resolve(tempPath) ? originalPath : loaded.path,
    dependencies: Array.from(dependencies),
  }
}

export async function loadViteConfigFile(
  configEnv: ConfigEnv,
  configFile: string | undefined,
  configRoot: string,
  configFileDependencies?: string[],
  configFileExport?: UserConfigExport,
  configLoader?: ConfigLoader,
  runner?: ConfigRunner,
) {
  const resolvedConfigFile = configFile ?? await resolveImplicitConfigFile(configRoot)
  if (!resolvedConfigFile) {
    return loadConfigFromFile(
      configEnv,
      configFile,
      configRoot,
      configFileDependencies,
      configFileExport,
      configLoader,
      runner,
    )
  }

  const source = await fs.readFile(resolvedConfigFile, 'utf8')
  const nonce = `${process.pid}-${Date.now()}`
  const { createdFiles, replacements } = await createWorkspaceImportReplacements(
    resolvedConfigFile,
    source,
    nonce,
  )
  const rewritten = rewriteWorkspaceImports(source, replacements)
  if (!rewritten.changed) {
    return loadConfigFromFile(
      configEnv,
      resolvedConfigFile,
      configRoot,
      configFileDependencies,
      configFileExport,
      configLoader,
      runner,
    )
  }

  const extension = path.extname(resolvedConfigFile)
  const basename = path.basename(resolvedConfigFile, extension)
  const tempPath = path.join(
    path.dirname(resolvedConfigFile),
    `.${basename}.weapp-vite-config-loader-${nonce}${extension}`,
  )

  await fs.writeFile(tempPath, rewritten.source)
  const tempArtifacts = [tempPath, ...createdFiles]
  tempArtifacts.forEach(file => TEMP_CONFIG_ARTIFACTS.add(file))
  ensureTempConfigCleanupRegistered()
  try {
    const loaded = await loadConfigFromFile(
      configEnv,
      tempPath,
      configRoot,
      configFileDependencies,
      configFileExport,
      'native',
      runner,
    )
    return normalizeLoadedResult(loaded, resolvedConfigFile, tempPath)
  }
  finally {
    scheduleTempConfigArtifactsCleanup(tempArtifacts)
  }
}
