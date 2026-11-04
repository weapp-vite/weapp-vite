import type { ControlledProject, FrameworkRelease, FrameworkTarget } from '../types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { corpusJson } from '../../archive'
import { wechatCustomMapping } from './mapping'

export const antUpstream = {
  repository: 'ant-design/ant-design-mini',
  commit: '08a3cb9ad53573c235ff9ea5f615ce56b5c4de39',
  version: '3.4.3',
} as const

/** 仅投影官方 AXML 任务的输入和组件支持白名单，不执行上游 scripts。 */
export const antInputRecipe = {
  source: { repository: antUpstream.repository, commit: antUpstream.commit, license: { spdx: 'MIT', files: ['LICENSE'] } },
  prefix: '',
  include: ['{src,demo,copilot,copilot-demo}/**/*.axml', '{src,copilot}/*/index.md'],
  exclude: ['**/__tests__/**'],
}

/** 上游开发和生产 AXML 任务相同；两种模式仍分别真实执行和记录。 */
export function createAntProject(release: FrameworkRelease, target: FrameworkTarget): ControlledProject {
  assert.equal(release.version, antUpstream.version, 'Unregistered Ant Design Mini compiler recipe')
  assert.deepEqual(release.upstream, { repository: antUpstream.repository, commit: antUpstream.commit }, 'Ant Design Mini requires its frozen upstream identity')
  assert.ok(['alipay', 'weapp'].includes(target.target), 'Unknown Ant Design Mini markup target')
  const upstream = `https://github.com/${antUpstream.repository}/blob/${antUpstream.commit}`
  const configuration = {
    schemaVersion: 1,
    upstream: antUpstream,
    pipeline: ['@diamondyuan/gulp-ifdef@0.3.0', '@alipay/axml-transverter@1.0.1'],
    modes: 'The official AXML transformation does not branch by NODE_ENV; each mode executes independently.',
    input: { include: antInputRecipe.include, exclude: antInputRecipe.exclude, category: 'preprocessor-input' },
    mapping: { file: 'wechat-mapping.json', source: `${upstream}/scripts/axml/mapping.ts`, sourceSha256: 'd96a11e88653ed48632b799a29d4427bfd39b0c7d2769513ea369d4aec240682', license: 'MIT' },
    references: [`${upstream}/scripts/mini-compiler.ts`, `${upstream}/scripts/create-config.js`, `${upstream}/scripts/compile-axml.ts`],
    upstreamLock: 'No lockfile exists in the complete frozen upstream tree; this project freezes its own exact dependency lock.',
  }
  return {
    dependencies: { '@diamondyuan/gulp-ifdef': '0.3.0', '@alipay/axml-transverter': '1.0.1', 'vinyl': '2.2.1' },
    files: {
      'compile.cjs': readFileSync(new URL('./runtime.cjs', import.meta.url), 'utf8'),
      'wechat-mapping.json': `${corpusJson(wechatCustomMapping)}\n`,
      'ant-pipeline.json': `${corpusJson(configuration)}\n`,
      'upstream-LICENSE.txt': readFileSync(new URL('./LICENSE', import.meta.url), 'utf8'),
    },
    command: ['node', 'compile.cjs', '{mode}', target.target, '{output}'],
    environment: {},
  }
}
