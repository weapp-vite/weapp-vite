import fs from 'fs-extra'
import path from 'pathe'

const target = path.resolve(import.meta.dirname, '../../../apps/weapp-vite-tailwindcss-template')
const dest = path.resolve(import.meta.dirname, '../templates/default')

async function main() {
  await fs.copy(target, dest, {
    filter(src: string) {
      if (src.includes('node_modules')) {
        return false
      }
      return true
    },
  })
}

main()
