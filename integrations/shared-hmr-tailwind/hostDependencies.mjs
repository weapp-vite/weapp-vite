import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 从实际解析入口读取包身份，兼容不导出 package.json 的依赖。 */
async function readInstalledPackageVersion(entry, name) {
  let directory = path.dirname(entry)
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
      if (manifest.name === name) {
        if (typeof manifest.version !== 'string' || !manifest.version) {
          throw new Error(`Missing installed package version: ${name}`)
        }
        return manifest.version
      }
    }
    catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error(`Installed package identity not found: ${name}`)
    }
    directory = parent
  }
}

export async function readHostDependencyOverrides(hostManifest) {
  const postcss = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('postcss/package.json')), 'utf8'))
  const rootConsumer = createRequire(new URL('../../packages/tailwindcss/package.json', import.meta.url))
  const tailwindcss = createRequire(rootConsumer.resolve('weapp-tailwindcss'))
  const postcssPlugin = createRequire(tailwindcss.resolve('@weapp-tailwindcss/postcss'))
  const converterEntry = postcssPlugin.resolve('postcss-rule-unit-converter')
  const converter = createRequire(converterEntry)
  const [converterVersion, sharedVersion] = await Promise.all([
    readInstalledPackageVersion(converterEntry, 'postcss-rule-unit-converter'),
    readInstalledPackageVersion(converter.resolve('postcss-plugin-shared'), 'postcss-plugin-shared'),
  ])
  // 私有宿主对齐编译器和插件的实际安装身份；保留发布年龄保护，不向公共包添加 override。
  return {
    'rolldown': hostManifest.dependencies.rolldown,
    'postcss': postcss.version,
    'postcss-rule-unit-converter': converterVersion,
    'postcss-plugin-shared': sharedVersion,
  }
}
