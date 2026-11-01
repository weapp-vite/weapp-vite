import type { PackageJson } from 'pkg-types'
import type { TemplateName } from '../enums'
import { fs } from '@weapp-core/shared/fs'
import { getLanguageFileAssociations } from '@weapp-vite/language-service'
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

const STYLE_FORMAT_RULES = [
  'alpha-value-notation',
  'at-rule-empty-line-before',
  'color-function-alias-notation',
  'color-function-notation',
  'color-hex-length',
  'comment-empty-line-before',
  'custom-property-empty-line-before',
  'declaration-empty-line-before',
  'font-family-name-quotes',
  'function-url-quotes',
  'hue-degree-notation',
  'import-notation',
  'keyframe-selector-notation',
  'length-zero-no-unit',
  'lightness-notation',
  'media-feature-range-notation',
  'rule-empty-line-before',
  'scss/at-else-empty-line-before',
  'scss/dollar-variable-empty-line-before',
  'scss/double-slash-comment-empty-line-before',
  'selector-attribute-quotes',
  'selector-not-notation',
  'selector-pseudo-element-colon-notation',
]

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
    'lint': 'weapp-vite-lint',
    'lint:fix': 'weapp-vite-lint --fix',
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
  settings['editor.formatOnSave'] = true
  settings['files.associations'] = { ...settings['files.associations'] as Record<string, string>, ...getLanguageFileAssociations() }
  for (const language of ['wxml', 'miniprogram-template', 'miniprogram-script', 'css']) {
    settings[`[${language}]`] = { 'editor.defaultFormatter': 'weapp-vite.weapp-vite' }
  }
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

  const stylelint = path.join(root, 'stylelint.config.js')
  if (await fs.pathExists(stylelint)) {
    const rules = Object.fromEntries(STYLE_FORMAT_RULES.map(rule => [rule, null]))
    await fs.writeFile(stylelint, `import { icebreaker } from '@icebreakers/stylelint-config'\n\nexport default icebreaker({\n  miniProgram: true,\n  presets: { order: false },\n  rules: ${JSON.stringify(rules, null, 2)},\n})\n`)
  }

  const readme = path.join(root, 'README.md')
  const content = await fs.readFile(readme, 'utf8').catch(() => '')
  await fs.writeFile(readme, `${content}\n## Vite Plus 工具链\n\n使用 \`pnpm dev\` / \`pnpm build\` 启动 Vite Plus；小程序类型与 IDE 工具仍使用 \`wv prepare\` / \`wv open\`。\n\n- \`pnpm lint\` / \`pnpm lint:fix\`：Oxlint 标准脚本检查及原生模板、脚本模块的平台诊断。\n- \`pnpm format\` / \`pnpm format:check\`：Oxfmt 标准文件、原生样式、WXS/SJS/KS 模块及保留文本原文的多平台模板格式化。\n- \`pnpm check\`：Vite Plus 标准检查、原生语言检查，以及适用的 Vue 专项和 Stylelint；不代替项目类型检查。\n${isWevu ? '- `pnpm lint:vue`：Vue 模板专项兼容性检查。\n' : ''}- \`pnpm stylelint\`：样式语义检查。\n\n规则由 \`@weapp-vite/oxlint\` 和 \`@weapp-vite/oxfmt\` 提供，在 \`vite.config.ts\` 的 \`lint\` / \`fmt\` 中扩展。原生模板和模块由项目的 \`lint\` / \`format\` / \`check\` 命令接入共享语言内核；直接 \`vp fmt\` 跳过这些文件。通过 \`weapp.language\` 设置平台和按文件覆盖；SJS 归属不明确时必须指定平台。格式化读取实际 \`fmt\` 与 \`overrides\`。已有 pnpm workspace 的 \`vp check\` 优先继承根配置；成员配置不能覆盖根策略，请在根配置按成员目录接入预设。\n`)
}
