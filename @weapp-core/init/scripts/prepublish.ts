import fs from 'fs-extra'
import path from 'pathe'

const templates = [
  {
    target: '../../../apps/weapp-vite-tailwindcss-template',
    dest: '../templates/default',
  },
  {
    target: '../../../apps/weapp-vite-tailwindcss-tdesign-template',
    dest: '../templates/tdesign',
  },
  {
    target: '../../../apps/weapp-vite-tailwindcss-vant-template',
    dest: '../templates/vant',
  },
]

async function main() {
  for (const { dest, target } of templates) {
    await fs.copy(
      path.resolve(import.meta.dirname, target),
      path.resolve(import.meta.dirname, dest),
      {
        filter(src: string) {
          if (src.includes('node_modules')) {
            return false
          }
          return true
        },
      },
    )
  }
}

main()
