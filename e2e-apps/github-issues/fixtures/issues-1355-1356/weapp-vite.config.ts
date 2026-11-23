import type { Plugin } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => {
  const isRuntime = mode.startsWith('runtime')
  const pruneUnusedFiles = mode.includes('prune')
  let root = ''
  let outDir = ''
  const observations: Record<string, boolean> = {}
  const stylesheet = () => path.join(outDir, 'miniprogram_npm/mini-lib/icon/index.wxss')
  const probe: Plugin = {
    name: 'issue-npm-artifact-observer',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(root, config.build.outDir)
    },
    async writeBundle() {
      observations.writeBundle = await readFile(stylesheet(), 'utf8').then(() => true, () => false)
    },
    async generateBundle() {
      if (isRuntime) {
        const source = JSON.parse(await readFile(path.join(root, 'project.config.json'), 'utf8')) as Record<string, unknown>
        this.emitFile({
          type: 'asset',
          fileName: 'project.config.json',
          source: JSON.stringify({ ...source, miniprogramRoot: './', setting: { es6: false, urlCheck: false, packNpmManually: false } }),
        })
      }
    },
    async closeBundle() {
      const source = await readFile(stylesheet(), 'utf8').catch(() => undefined)
      observations.closeBundle = source !== undefined
      if (source !== undefined) {
        await writeFile(stylesheet(), `${source}\n/* artifact observer completed */\n`)
      }
      await writeFile(path.join(root, 'hook-observations.json'), JSON.stringify(observations))
    },
  }
  return {
    plugins: [probe],
    weapp: {
      platform: 'weapp',
      srcRoot: 'src',
      npm: {
        pruneUnusedFiles,
        mainPackage: { dependencies: ['mini-lib'] },
        packageFiles: { 'mini-lib': { exclude: ['unused/**'] } },
      },
    },
  }
})
