import type { PackageJson } from 'pkg-types'
import type { TemplateName } from '../enums'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { devDependencies as eslintDependencies } from '../../../eslint/package.json'
import { getTemplateDefinition } from '../templates'
import { writeJsonFile } from '../utils/fs'

const VUE_TEMPLATE_CONFIG = `import { wevuCompatibilityPlugin } from '@weapp-vite/eslint'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default [{
  files: ['**/*.vue'],
  ignores: ['**/node_modules/**', '**/dist*/**', '**/.weapp-vite/**'],
  languageOptions: {
    parser: vueParser,
    parserOptions: { parser: tsParser, sourceType: 'module', extraFileExtensions: ['.vue'] },
  },
  plugins: { wevu: wevuCompatibilityPlugin },
  rules: { 'wevu/no-unsupported-template-feature': 'error' },
}]
`

/** 发布阶段给共享模板安装独立的代码质量配置，不改动用户的上级工作区。 */
export async function prepareVitePlusQuality(root: string, pkg: PackageJson, template: TemplateName) {
  const isWevu = getTemplateDefinition(template).framework === 'wevu'
    || (await fs.readdir(root, { recursive: true })).some(file => String(file).endsWith('.vue'))
  pkg.devDependencies ??= {}
  pkg.devDependencies['@weapp-vite/oxlint'] = 'workspace:*'
  pkg.devDependencies['@weapp-vite/oxfmt'] = 'workspace:*'
  delete pkg.devDependencies['@icebreakers/eslint-config']
  pkg.scripts = {
    ...pkg.scripts,
    'lint': 'vp lint',
    'lint:fix': 'vp lint --fix',
    'format': 'weapp-vite-format --write',
    'format:check': 'weapp-vite-format --check',
    'check': 'weapp-vite-format --check-all',
  }
  if (isWevu) {
    pkg.devDependencies['@weapp-vite/eslint'] = 'workspace:*'
    pkg.devDependencies['@typescript-eslint/parser'] = eslintDependencies['@typescript-eslint/parser']
    pkg.devDependencies['vue-eslint-parser'] = eslintDependencies['vue-eslint-parser']
    pkg.scripts['lint:vue'] = 'eslint "**/*.vue"'
    pkg.scripts['lint:vue:fix'] = 'eslint "**/*.vue" --fix'
    await fs.writeFile(path.join(root, 'eslint.config.js'), VUE_TEMPLATE_CONFIG)
  }
  else {
    delete pkg.devDependencies.eslint
    await fs.remove(path.join(root, 'eslint.config.js'))
  }

  const settingsFile = path.join(root, '.vscode/settings.json')
  const settings = await fs.readJSON(settingsFile).catch(() => ({})) as Record<string, unknown>
  settings['editor.defaultFormatter'] = 'oxc.oxc-vscode'
  settings['editor.codeActionsOnSave'] = {
    'source.fixAll': 'never',
    'source.fixAll.oxc': 'explicit',
    'source.fixAll.eslint': isWevu ? 'explicit' : 'never',
    'source.fixAll.stylelint': 'never',
    'source.organizeImports': 'never',
  }
  delete settings['eslint.rules.customizations']
  settings['eslint.validate'] = isWevu ? ['vue'] : []
  await writeJsonFile(settingsFile, settings)
  const extensionsFile = path.join(root, '.vscode/extensions.json')
  const extensions = await fs.readJSON(extensionsFile).catch(() => ({})) as { recommendations?: string[] }
  extensions.recommendations = [...new Set([
    ...(extensions.recommendations ?? []).filter(name => isWevu || name !== 'dbaeumer.vscode-eslint'),
    'oxc.oxc-vscode',
  ])]
  await writeJsonFile(extensionsFile, extensions)

  const readme = path.join(root, 'README.md')
  const content = await fs.readFile(readme, 'utf8').catch(() => '')
  await fs.writeFile(readme, `${content}\n## Vite Plus 工具链\n\n使用 \`pnpm dev\` / \`pnpm build\` 启动 Vite Plus；小程序类型与 IDE 工具仍使用 \`wv prepare\` / \`wv open\`。\n\n- \`pnpm lint\` / \`pnpm lint:fix\`：Oxlint 脚本与小程序兼容性检查。\n- \`pnpm format\` / \`pnpm format:check\`：Oxfmt 标准文件/WXSS 格式化及保留文本原文的 WXML 适配器。\n- \`pnpm check\`：Vite Plus 的 lint/格式检查与 WXML 适配器检查；不代替项目类型检查。\n${isWevu ? '- `pnpm lint:vue`：Vue 模板专项兼容性检查。\n' : ''}- \`pnpm stylelint\`：样式语义检查。\n\n规则由 \`@weapp-vite/oxlint\` 和 \`@weapp-vite/oxfmt\` 提供，在 \`vite.config.ts\` 的 \`lint\` / \`fmt\` 中扩展。标准 \`vp fmt\` 跳过 WXML；项目的 \`format\` / \`check\` 命令才包含安全适配器，并读取实际 \`fmt\` 与 \`overrides\`。已有 pnpm workspace 的 \`vp check\` 优先继承根配置；成员配置不能覆盖根策略，请在根配置按成员目录接入预设。\n`)
}
