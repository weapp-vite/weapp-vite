import path from 'node:path'
import process from 'node:process'
import { confirm, input, select } from '@inquirer/prompts'
import { initConfig } from '@weapp-core/init'
import logger from '@weapp-core/logger'
import { fs } from '@weapp-core/shared/fs'
import { validateDependencyVersionStrategy } from './dependencyVersions'
import { createProject, TemplateName } from './index'
import { RECOMMENDED_SKILLS_INSTALL_COMMAND } from './skills'
import { validateToolchain } from './toolchain'

const cwd = process.cwd()

const TEMPLATE_CHOICES: Array<{ name: string, value: TemplateName }> = [
  {
    name: '默认模板',
    value: TemplateName.default,
  },
  {
    name: '原生多平台 + Web 模板',
    value: TemplateName.multiPlatform,
  },
  {
    name: 'Vue SFC 多平台 + Web 模板',
    value: TemplateName.multiPlatformSfc,
  },
  {
    name: 'Wevu 模板 (Vue SFC)',
    value: TemplateName.wevu,
  },
  {
    name: 'React 模板 (React 19 + 小程序 runtime)',
    value: TemplateName.react,
  },
  {
    name: 'Wevu + TDesign 模板 (wevu + tdesign + tailwindcss)',
    value: TemplateName.wevuTdesign,
  },
  {
    name: '集成 Tailwindcss',
    value: TemplateName.tailwindcss,
  },
  {
    name: 'TDesign 模板 (tdesign + tailwindcss)',
    value: TemplateName.tdesign,
  },
  {
    name: 'Vant 模板 (vant + tailwindcss)',
    value: TemplateName.vant,
  },
  {
    name: '插件模板 (src + pluginRoot)',
    value: TemplateName.plugin,
  },
  {
    name: '组件库模板 (lib 模式)',
    value: TemplateName.lib,
  },
]

function parseCliArgs(argv: string[]) {
  const positionals: string[] = []
  let installSkills: boolean | undefined
  let dependencyVersionStrategy = 'bundled'
  let registry: string | undefined
  let toolchain = 'wv'

  for (const arg of argv) {
    if (arg === '--') {
      continue
    }
    if (arg.startsWith('--toolchain=')) {
      toolchain = arg.slice('--toolchain='.length)
      continue
    }
    if (arg === '--toolchain') {
      throw new Error('请使用 --toolchain=wv、--toolchain=vite 或 --toolchain=vite-plus')
    }
    if (arg.startsWith('--registry=')) {
      registry = arg.slice('--registry='.length)
      if (!registry) {
        throw new Error('请使用 --registry=<http(s) URL>')
      }
      continue
    }
    if (arg === '--registry') {
      throw new Error('请使用 --registry=<http(s) URL>')
    }
    if (arg.startsWith('--dependency-versions=')) {
      dependencyVersionStrategy = arg.slice('--dependency-versions='.length)
      continue
    }
    if (arg === '--dependency-versions') {
      throw new Error('请使用 --dependency-versions=compatible 或 --dependency-versions=bundled')
    }
    if (arg === '--install-skills') {
      installSkills = true
      continue
    }
    if (arg === '--no-install-skills') {
      installSkills = false
      continue
    }
    positionals.push(arg)
  }

  validateDependencyVersionStrategy(dependencyVersionStrategy)
  validateToolchain(toolchain)

  return {
    command: positionals[0],
    targetDir: positionals[0],
    templateName: positionals[1] as TemplateName | undefined,
    installSkills,
    dependencyVersionStrategy,
    registry,
    toolchain,
  }
}

// Note: export a callable run() for tests; still invoke at module load for CLI
export async function run() {
  // Support non-interactive usage: node cli.mjs <targetDir> <templateName>
  // Example: node dist/cli.js my-app default
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  if (parsedArgs.command === 'init') {
    await initConfig({
      command: 'weapp-vite',
    })
    return
  }

  const { targetDir: argTarget, templateName: argTemplate, installSkills: argInstallSkills } = parsedArgs
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
    ? argTemplate ?? TemplateName.default
    : await select<TemplateName>({
        message: '选择模板',
        choices: TEMPLATE_CHOICES,
        default: TemplateName.default,
      })

  const installSkills = argInstallSkills ?? (isArgMode
    ? false
    : await confirm({
        message: `是否安装推荐的 AI skills？将执行 \`${RECOMMENDED_SKILLS_INSTALL_COMMAND}\`，也可稍后手动执行`,
        default: false,
      }))

  await createProject(targetDir, templateName, {
    installSkills,
    dependencyVersionStrategy: parsedArgs.dependencyVersionStrategy,
    registry: parsedArgs.registry,
    toolchain: parsedArgs.toolchain,
  })
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
    process.exitCode = 1
  },
)
