import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台解析 pnpm shim，并保留文件名的独立 argv 边界。
import { execaSync } from 'execa'

export const SCRIPT_FILES = /\.(?:[cm]?[jt]sx?|vue)$/
export const STYLE_FILES = /\.(?:css|scss|sass|less|wxss|acss|ttss|qss|jxss|vue)$/
export const DOCUMENT_FILES = /\.(?:json|md|mdx|html|yml|yaml)$/
export const PROJECT_CONFIG = /(?:^|\/)project(?:\.private)?\.config\.json$/
export const ROOT_CHANGESET = /^\.changeset\/[^/]+\.md$/
const SKILL_INPUT = /^(?:AGENTS\.md$|CLAUDE\.md$|skills\/|website\/guide\/(?:ai|ai-workflows|skills)\.md$|website\/packages\/create-weapp-vite\.md$|website\/\.vitepress\/components\/AiLearningPage\.vue$|packages\/create-weapp-vite\/src\/agents\.ts$)/

/** 从 Git 读取 NUL 分隔路径，避免空格、引号和非 ASCII 文件名经过 shell。 */
export function stagedFiles(root = process.cwd()) {
  return execaSync('git', ['-c', 'core.fsmonitor=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd: root }).stdout.split('\0').filter(Boolean)
}

/**
 * 为串行校验选择文件；apps 保持独立验证，临时 E2E 文件不进入样式修复。
 * @param {string[]} files 暂存文件。
 */
export function selectStagedFiles(files) {
  const lintable = files.filter(file => !file.startsWith('apps/'))
  return {
    changesets: files.filter(file => ROOT_CHANGESET.test(file)),
    eslint: lintable.filter(file => SCRIPT_FILES.test(file) || (DOCUMENT_FILES.test(file) && !PROJECT_CONFIG.test(file) && !ROOT_CHANGESET.test(file))),
    styles: lintable.filter(file => STYLE_FILES.test(file) && !file.startsWith('e2e-apps/__temp__/')),
    projectConfigs: files.filter(file => PROJECT_CONFIG.test(file)),
    e2e: files.some(file => /^e2e\/.*\.(?:ts|tsx|mts)$/.test(file)),
    skillsYaml: files.some(file => /^skills\/.*\.ya?ml$/.test(file)),
    skillsSync: files.some(file => SKILL_INPUT.test(file)),
  }
}
