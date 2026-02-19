import path from 'node:path'
import process from 'node:process'
import { confirm, input, select } from '@inquirer/prompts'
import logger from '@weapp-core/logger'
import fs from 'fs-extra'
import { createProject, TemplateName } from './index'

const cwd = process.cwd()
// Note: export a callable run() for tests; still invoke at module load for CLI
export async function run() {
  // Support non-interactive usage: node cli.mjs <targetDir> <templateName>
  // Example: node dist/cli.js my-app default
  const [argTarget, argTemplate] = process.argv.slice(2)
  const isArgMode = Boolean(argTarget)
  const targetDir = isArgMode
    ? argTarget
    : await input({ message: '创建应用的目录', default: 'my-app' })
  const dir = path.resolve(cwd, targetDir)
  const existed = await fs.exists(dir)
  if (existed) {
    const isOverwrite = isArgMode ? true : await confirm({ message: '目录已存在，是否覆盖？', default: false })
    if (!isOverwrite) {
      return
    }
  }
  const templateName = isArgMode
    ? (argTemplate as TemplateName | undefined) ?? TemplateName.default
    : await select<TemplateName>({
        message: '选择模板',
        choices: [
          {
            name: '默认模板',
            value: TemplateName.default,
          },
          {
            name: '组件库模板 (lib 模式)',
            value: TemplateName.lib,
          },
          {
            name: 'Wevu 模板 (Vue SFC)',
            value: TemplateName.wevu,
          },
          {
            name: 'Wevu + TDesign 模板 (wevu + tdesign + tailwindcss)',
            value: TemplateName.wevuTdesign,
          },
          {
            name: 'Wevu Retail 模板 (wevu + tdesign + tailwindcss + mokup)',
            value: TemplateName.wevuRetail,
          },
          {
            name: '集成 Tailwindcss',
            value: TemplateName.tailwindcss,
          },
          {
            name: 'Vant 模板 (vant + tailwindcss)',
            value: TemplateName.vant,
          },
          {
            name: 'TDesign 模板 (tdesign + tailwindcss)',
            value: TemplateName.tdesign,
          },
        ],
        default: TemplateName.default,
      })
  await createProject(targetDir, templateName)
}

/**
 * @description CLI 主入口执行 Promise（便于测试或外部调用）
 */
export const runPromise = run().catch(
  (err) => {
    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes('cancel')) {
      logger.warn('✗ 已取消创建')
      return
    }
    logger.error('✗ 创建失败:', message)
  },
)
