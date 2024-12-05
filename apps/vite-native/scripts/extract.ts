import fs from 'fs-extra'
import path from 'pathe'

const targets = [
  {
    name: 'vant',
    dir: '@vant/weapp/dist',
    isComponent(dir: string) {
      return fs.exists(path.resolve(dir, 'index.js'))
    },
  },
  {
    name: 'tdesign',
    dir: 'tdesign-miniprogram/miniprogram_dist',
    async isComponent(dir: string) {
      const basename = path.basename(dir)
      return (await fs.exists(path.resolve(dir, `${basename}.js`))) && !['common'].includes(basename)
    },
  },
]

for (const { dir, name, isComponent } of targets) {
  const baseDir = path.resolve(import.meta.dirname, `../node_modules/${dir}`)
  const dirs = (
    await Promise.all(
      (await fs.readdir(baseDir))
        .map(async (x) => {
          let isIncluded = false
          const targetDir = path.resolve(baseDir, x)
          const stat = await fs.stat(targetDir)
          if (stat.isDirectory() && await isComponent(targetDir)) {
            isIncluded = true
          }
          return {
            name: x,
            isIncluded,
          }
        }),
    )).filter(x => x.isIncluded).map(x => x.name)
  const result = dirs.filter((x) => {
    return !x.startsWith('.')
  })
  await fs.outputJSON(path.resolve(import.meta.dirname, `${name}.json`), result, {
    spaces: 2,
  })
  await fs.outputJSON(path.resolve(import.meta.dirname, '../../../packages/weapp-vite/src/auto-import-components/resolvers/json', `${name}.json`), result, {
    spaces: 2,
  })
}
