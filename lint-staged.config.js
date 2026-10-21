import { realpathSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const WECHAT_DEVTOOLS_PROJECT_CONFIG_RE = /(?:^|\/)project(?:\.private)?\.config\.json$/
const E2E_TEMP_APP_RE = /(?:^|\/)e2e-apps\/__temp__\//

function isWechatDevtoolsProjectConfig(file) {
  return WECHAT_DEVTOOLS_PROJECT_CONFIG_RE.test(file)
}

function filterWechatDevtoolsProjectConfigs(files) {
  return files.filter((file) => {
    return !isWechatDevtoolsProjectConfig(file)
  })
}

function filterTempE2eAppFiles(files) {
  return files.filter((file) => {
    return !E2E_TEMP_APP_RE.test(file)
  })
}

function resolveDirectory(directory) {
  try {
    return realpathSync(directory)
  }
  catch (error) {
    const parent = path.dirname(directory)
    if (parent !== directory && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return path.join(resolveDirectory(parent), path.basename(directory))
    }
    throw error
  }
}

function isRootChangeset(file) {
  // lint-staged 在隐藏未暂存删除前生成任务，父目录此时可能尚不存在。
  const absoluteFile = path.join(resolveDirectory(path.dirname(file)), path.basename(file))
  return /^\.changeset\/[^/]+\.md$/.test(path.relative(realpathSync(process.cwd()), absoluteFile).replaceAll('\\', '/'))
}

export default {
  // 语义门禁读取索引，不能用未暂存的修复或格式化结果替代提交内容。
  // 数组任务让 lint-staged 保留文件 argv 边界，并串行执行语义校验和格式修复。
  '.changeset/*.md': [
    'node scripts/check-changeset-frontmatter.mjs --staged',
    'eslint --fix --no-ignore --max-warnings=0 --no-warn-ignored',
  ],
  // 校验当前源码，不生成或暂存共享清单；包括间接引用的计划和矩阵。
  'e2e/**/*.{ts,tsx,mts}': () => 'pnpm e2e:dom-acceptance:check',
  '**/project{,.private}.config.json': (files) => {
    const projectConfigFiles = files.filter(isWechatDevtoolsProjectConfig)

    if (projectConfigFiles.length === 0) {
      return []
    }

    return [`node scripts/fix-wechat-devtools-project-config-eof.mjs ${projectConfigFiles.join(' ')}`]
  },
  'skills/**/*.{yaml,yml}': ['node skills/scripts/validate-skills-yaml.mjs'],
  '{AGENTS.md,CLAUDE.md,skills/**/*,website/guide/{ai,ai-workflows,skills}.md,website/packages/create-weapp-vite.md,website/.vitepress/components/AiLearningPage.vue,packages/create-weapp-vite/src/agents.ts}': [
    'node skills/scripts/check-public-skill-sync.mjs',
  ],
  '!(apps)/**/*.{js,jsx,mjs,ts,tsx,mts,vue}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
  ],
  '!(apps)/**/*.{css,scss,less,wxss,acss,ttss,qss,jxss,vue}': (files) => {
    const lintableFiles = filterTempE2eAppFiles(files)

    if (lintableFiles.length === 0) {
      return []
    }

    return [`stylelint --fix --allow-empty-input ${lintableFiles.join(' ')}`]
  },
  '!(apps)/**/*.{json,md,mdx,html,yml,yaml}': (files) => {
    const lintableFiles = filterWechatDevtoolsProjectConfigs(files).filter(file => !isRootChangeset(file))

    if (lintableFiles.length === 0) {
      return []
    }

    return [
      // 'prettier --with-node-modules --ignore-path .prettierignore --write',
      `eslint --fix --max-warnings=0 --no-warn-ignored ${lintableFiles.join(' ')}`,
    ]
  },
  // Rust 相关
  // '*.rs': ['cargo fmt --'],
}
