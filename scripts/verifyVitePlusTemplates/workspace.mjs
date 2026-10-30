import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseDocument } from 'yaml'

const policyMessage = 'workspace-root-rule-probe'

function rootConfig(semi = false) {
  return `import { recommended } from '@weapp-vite/oxfmt'

export default {
  lint: {
    categories: { correctness: 'off' },
    ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.weapp-vite/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'workspace-policy-probe', message: '${policyMessage}' }] }],
    },
  },
  fmt: { ...recommended, semi: ${semi} },
}
`
}

/** 工作区测试的策略来源仍由真实脚手架生成，不维护第二份依赖与安装审批模板。 */
export async function prepareParentWorkspace(root, seed) {
  const manifest = JSON.parse(await fs.readFile(path.join(seed, 'package.json'), 'utf8'))
  const document = parseDocument(await fs.readFile(path.join(seed, 'pnpm-workspace.yaml'), 'utf8'))
  document.set('packages', ['apps/*'])
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, 'pnpm-workspace.yaml'), document.toString())
  await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify({
    name: 'vite-plus-workspace-consumer',
    private: true,
    type: 'module',
    devDependencies: Object.fromEntries(['vite-plus', 'vite', '@weapp-vite/oxfmt'].map(name => [name, manifest.devDependencies[name]])),
  }, null, 2)}\n`)
  await fs.writeFile(path.join(root, 'vite.config.ts'), rootConfig())
  const files = ['package.json', 'pnpm-workspace.yaml', 'vite.config.ts']
  const snapshots = await Promise.all(files.map(file => fs.readFile(path.join(root, file))))
  return async () => {
    for (const [index, file] of files.entries()) {
      assert.deepEqual(await fs.readFile(path.join(root, file)), snapshots[index], `Scaffold modified parent workspace ${file}`)
    }
  }
}

/** 同一成员先通过自身配置，再被根 lint/fmt 分别拒绝，证明综合检查的配置来源。 */
export async function verifyWorkspaceInheritance(root, project, runScript) {
  const probe = path.join(project, 'src/workspace-policy-probe.ts')
  const config = path.join(root, 'vite.config.ts')
  const original = await fs.readFile(config)
  try {
    await fs.writeFile(probe, 'import \'workspace-policy-probe\'\n')
    await runScript('lint', 'workspace-member-lint')
    await runScript('check', 'workspace-root-lint', policyMessage)
    await fs.writeFile(probe, 'export const workspaceQuoteProbe = \'workspace-root-format\'\n')
    await fs.writeFile(config, rootConfig(true))
    await runScript('format:check', 'workspace-member-format')
    await runScript('check', 'workspace-root-format', /formatting issues|code style issues|format check failed/i)
  }
  finally {
    await fs.rm(probe, { force: true })
    await fs.writeFile(config, original)
  }
}
