import fs from 'fs-extra'
import path from 'pathe'
import { TemplateName } from '../src/enums'

const templates = [
  {
    target: '../../../apps/weapp-vite-template',
    dest: `../templates/${TemplateName.default}`,
  },
  {
    target: '../../../apps/weapp-vite-tailwindcss-template',
    dest: `../templates/${TemplateName.tailwindcss}`,
  },
  {
    target: '../../../apps/weapp-vite-tailwindcss-tdesign-template',
    dest: `../templates/${TemplateName.tdesign}`,
  },
  {
    target: '../../../apps/weapp-vite-tailwindcss-vant-template',
    dest: `../templates/${TemplateName.vant}`,
  },
]

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
