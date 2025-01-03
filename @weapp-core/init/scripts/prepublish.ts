import fs from 'fs-extra'
import path from 'pathe'
import { Templates } from './constants'

const templates = Templates.map((x) => {
  return {
    target: `../../../apps/${x.target}`,
    dest: `../templates/${x.dest}`,
  }
})

async function main() {
  for (const { dest, target } of templates) {
    const absDest = path.resolve(import.meta.dirname, dest)
    await fs.emptyDir(
      absDest,
    )
    await fs.copy(
      path.resolve(import.meta.dirname, target),
      absDest,
      {
        filter(src: string) {
          if (
            src.includes('node_modules')
            || src.includes('vite.config.ts.timestamp')
            || src.includes('dist')) {
            return false
          }
          return true
        },
      },
    )
  }
}

main()
