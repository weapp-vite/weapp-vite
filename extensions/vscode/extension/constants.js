const OUTPUT_CHANNEL_NAME = 'weapp-vite'
const STATUS_BAR_PRIORITY = 120
const TERMINAL_NAME = 'weapp-vite'
const WEAPP_VITE_SCRIPT_PATTERN = /\b(?:wv|weapp-vite)\b/
const WEAPP_VITE_CONFIG_PATTERN = /\bweapp-vite\b/
const VITE_CONFIG_FILE_PATTERN = /vite\.config\./
const PACKAGE_JSON_FILE_PATTERN = /(?:^|\/)package\.json$/
const VUE_JSON_BLOCK_PATTERN = /<json(?:\s+lang="(?:json|jsonc|json5)")?\s*>/u
const PACKAGE_JSON_PROPERTY_PREFIX_PATTERN = /^\s*"/
const COMMON_SCRIPT_NAMES = ['dev', 'build', 'generate', 'open']
const PACKAGE_JSON_DIAGNOSTIC_SOURCE = 'weapp-vite/package.json'
const DOCS_BASE_URL = 'https://vite.icebreaker.top'
const DOCS_GUIDE_URL = `${DOCS_BASE_URL}/guide/`
const DOCS_GENERATE_URL = `${DOCS_GUIDE_URL}generate.html`
const DOCS_VSCODE_URL = 'https://github.com/weapp-vite/weapp-vite/tree/main/extensions/vscode'
const SCRIPT_COMMAND_SUGGESTIONS = {
  dev: 'wv dev',
  build: 'wv build',
  open: 'wv open',
  generate: 'wv generate',
}

const COMMAND_DEFINITIONS = {
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

module.exports = {
  COMMAND_DEFINITIONS,
  COMMON_SCRIPT_NAMES,
  DOCS_GENERATE_URL,
  DOCS_GUIDE_URL,
  DOCS_VSCODE_URL,
  OUTPUT_CHANNEL_NAME,
  PACKAGE_JSON_DIAGNOSTIC_SOURCE,
  PACKAGE_JSON_FILE_PATTERN,
  PACKAGE_JSON_PROPERTY_PREFIX_PATTERN,
  SCRIPT_COMMAND_SUGGESTIONS,
  STATUS_BAR_PRIORITY,
  TERMINAL_NAME,
  VITE_CONFIG_FILE_PATTERN,
  VUE_JSON_BLOCK_PATTERN,
  WEAPP_VITE_CONFIG_PATTERN,
  WEAPP_VITE_SCRIPT_PATTERN,
}
