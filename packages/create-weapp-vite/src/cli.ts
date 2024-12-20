import type { TemplateName } from '@weapp-core/init'
import path from 'node:path'
import process from 'node:process'
import { confirm, input, select } from '@inquirer/prompts'
import { createProject } from '@weapp-core/init'
import fs from 'fs-extra'
// const [targetDir, templateName] = process.argv.slice(2)
const cwd = process.cwd()
async function main() {
  const targetDir = await input({ message: '创建应用的目录', default: 'my-app' })
  const dir = path.resolve(cwd, targetDir)
  const existed = await fs.exists(dir)
  if (existed) {
    const isOverwrite = await confirm({ message: '目录已存在，是否覆盖？', default: false })
    if (!isOverwrite) {
      return
    }
  }
  const templateName = await select({
    message: '选择模板',
    choices: [
      {
        name: '默认模板 (tailwindcss)',
        value: 'default',
      },
      {
        name: 'Vant 模板 (vant + tailwindcss)',
        value: 'vant',
      },
      {
        name: 'TDesign 模板 (tdesign + tailwindcss)',
        value: 'tdesign',
      },
    ],
    default: 'default',
  })
  await createProject(targetDir, templateName as TemplateName)
}

main()
