import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 只给隔离 fixture 配置添加原生发布观察，不修改用户配置或构建产物。 */
export async function addNativePublicationPlugin(configPath: string) {
  const source = await readFile(configPath, 'utf8')
  const declaration = source.match(/export\s+default\s+(?:defineConfig(?:<[\s\S]*?>)?\s*\(\s*)?\{/)?.[0]
  if (!declaration) {
    throw new Error('Native publication fixture must export a configuration object')
  }
  const observer = pathToFileURL(path.join(import.meta.dirname, 'plugin.ts')).href
  const plugin = 'nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })'
  const configured = /\bplugins:\s*\[/.test(source)
    ? source.replace(/\bplugins:\s*\[/, opening => `${opening}${plugin}, `)
    : source.replace(declaration, `${declaration}\n  plugins: [${plugin}],`)
  await writeFile(configPath, `import { nativePublicationPlugin } from ${JSON.stringify(observer)}\n${configured}`)
}
