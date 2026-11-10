import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { formatChangesetMarkdown } from '../changeset-utils'

const BUILTIN_FILE = 'packages-runtime/wevu-compiler/src/auto-import-components/builtin.auto.ts'
const RESOLVER_FILES = new Set(['tdesign', 'vant', 'weui'].map(name => `packages/weapp-vite/src/auto-import-components/resolvers/json/${name}.json`))

/** 仅为组件生成产物的实际变化创建可重复的发布记录。 */
export function planComponentChangeset(changedFiles: string[], diff: string) {
  const packages: string[] = []
  const summary: string[] = []
  if (changedFiles.includes(BUILTIN_FILE)) {
    packages.push('@wevu/compiler')
    summary.push('更新微信内置组件识别清单。')
  }
  if (changedFiles.some(file => RESOLVER_FILES.has(file))) {
    packages.push('weapp-vite', 'create-weapp-vite')
    summary.push('更新组件库自动导入清单，并同步脚手架依赖版本。')
  }
  if (!packages.length) {
    return undefined
  }
  if (!diff.trim()) {
    throw new Error('Component changes require a non-empty generated diff')
  }
  const hash = createHash('sha256').update(diff).digest('hex').slice(0, 16)
  return {
    path: `.changeset/wechat-components-${hash}.md`,
    content: formatChangesetMarkdown(packages, 'patch', `fix: ${summary.join('')}`),
  }
}

/** 不覆盖已有发布意图；同一组件差异重复运行时复用同一文件。 */
export async function writeComponentChangeset(plan: { path: string, content: string }) {
  try {
    await writeFile(plan.path, plan.content, { flag: 'wx' })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await readFile(plan.path, 'utf8') !== plan.content) {
      throw error
    }
  }
}

export const COMPONENT_OUTPUT_FILES = [BUILTIN_FILE, ...RESOLVER_FILES]
