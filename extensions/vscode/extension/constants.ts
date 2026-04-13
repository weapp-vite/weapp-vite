export interface CommandDefinition {
  id: string
  label: string
  detail: string
  scriptCandidates: string[]
  fallbackCommand: string
  terminalName?: string
}

export const OUTPUT_CHANNEL_NAME = 'weapp-vite'
export const STATUS_BAR_PRIORITY = 120
export const TERMINAL_NAME = 'weapp-vite'
export const WEAPP_VITE_SCRIPT_PATTERN = /\b(?:wv|weapp-vite)\b/
export const WEAPP_VITE_CONFIG_PATTERN = /\bweapp-vite\b/
export const VITE_CONFIG_FILE_PATTERN = /vite\.config\./
export const APP_JSON_FILE_PATTERN = /(?:^|\/)app\.json$/
export const PACKAGE_JSON_FILE_PATTERN = /(?:^|\/)package\.json$/
export const VUE_JSON_BLOCK_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>/u
export const PACKAGE_JSON_PROPERTY_PREFIX_PATTERN = /^\s*"/
export const COMMON_SCRIPT_NAMES = ['dev', 'build', 'generate', 'open']
export const APP_JSON_DIAGNOSTIC_SOURCE = 'weapp-vite/app.json'
export const PACKAGE_JSON_DIAGNOSTIC_SOURCE = 'weapp-vite/package.json'
export const DOCS_BASE_URL = 'https://vite.icebreaker.top'
export const DOCS_GUIDE_URL = `${DOCS_BASE_URL}/guide/`
export const DOCS_GENERATE_URL = `${DOCS_GUIDE_URL}generate.html`
export const DOCS_VSCODE_URL = 'https://github.com/weapp-vite/weapp-vite/tree/main/extensions/vscode'
export const SCRIPT_COMMAND_SUGGESTIONS: Record<string, string> = {
  dev: 'wv dev',
  build: 'wv build',
  open: 'wv open',
  generate: 'wv generate',
}

export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  dev: {
    id: 'dev',
    label: '启动开发',
    detail: '优先执行 package.json 中的 dev 或 dev:open 脚本。',
    scriptCandidates: ['dev', 'dev:open'],
    fallbackCommand: 'wv dev',
  },
  build: {
    id: 'build',
    label: '构建',
    detail: '优先执行 package.json 中的 build 脚本。',
    scriptCandidates: ['build'],
    fallbackCommand: 'wv build',
  },
  generate: {
    id: 'generate',
    label: '生成配置',
    detail: '优先执行 generate 或 g 脚本。',
    scriptCandidates: ['generate', 'g'],
    fallbackCommand: 'wv generate',
  },
  open: {
    id: 'open',
    label: '打开开发者工具',
    detail: '优先执行 open 脚本。',
    scriptCandidates: ['open'],
    fallbackCommand: 'wv open',
  },
  doctor: {
    id: 'doctor',
    label: '环境诊断',
    detail: '执行 CLI 诊断信息，便于快速确认环境。',
    scriptCandidates: ['doctor', 'info'],
    fallbackCommand: 'wv info',
  },
}
