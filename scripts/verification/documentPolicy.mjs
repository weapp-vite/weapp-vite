/** 仅根贡献与代理约定属于独立文档；包文档和生成规则继续交给所属检查。 */
export function isRootPolicyDocument(file) {
  return typeof file === 'string' && /^(?:CONTRIBUTING\.md|AGENTS(?:\.local)?\.md|README(?:[.-][\w-]+)?\.md|LICENSE(?:\.md|\.txt)?)$/u.test(file)
}

export const DOCUMENT_CONTRACTS = {
  agents: 'agents:check',
  skills: 'skills:check',
}

const PUBLIC_SKILL_CONTRACT_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'packages/create-weapp-vite/src/agents.ts',
  'website/.vitepress/components/AiLearningPage.vue',
  'website/guide/ai-workflows.md',
  'website/guide/ai.md',
  'website/guide/skills.md',
  'website/packages/create-weapp-vite.md',
])

/** 生成目标与规则输入共享最小契约；删除和重命名旧端点也必须参与选择。 */
export function requiredDocumentContracts(files) {
  const checks = new Set()
  for (const file of files) {
    if (/(?:^|\/)AGENTS\.md$/u.test(file) || file.startsWith('scripts/agents/')
      || file === 'packages/create-weapp-vite/src/generated/agents.ts') {
      checks.add('agents')
    }
    if (PUBLIC_SKILL_CONTRACT_FILES.has(file) || file.startsWith('skills/')) {
      checks.add('skills')
    }
  }
  return Object.keys(DOCUMENT_CONTRACTS).filter(check => checks.has(check))
}

/** 重命名两端均须是已知文档，缺失清单、未知输入和分页截断均保守处理。 */
export function rootDocumentationChanges(files) {
  if (!Array.isArray(files) || !files.length || files.length >= 3000
    || files.some(file => !['added', 'modified', 'removed', 'renamed', 'copied', 'changed'].includes(file.status)
      || !isRootPolicyDocument(file.filename)
      || (file.status === 'renamed' && !file.previous_filename)
      || (file.previous_filename !== undefined && !isRootPolicyDocument(file.previous_filename)))) {
    return null
  }
  return [...new Set(files.filter(file => file.status !== 'removed').map(file => file.filename))].sort()
}
