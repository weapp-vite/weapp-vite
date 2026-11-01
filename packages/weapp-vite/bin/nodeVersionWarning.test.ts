import { stripVTControlCharacters } from 'node:util'
import { describe, expect, it } from 'vitest'
import { runBootstrapFixture } from '../test/helpers/bootstrapFixture'

describe('cold Node version warning formatter without workspace dist', () => {
  it.each([
    { name: 'forced colors', env: { FORCE_COLOR: '1' }, colored: true },
    { name: 'disabled colors', env: { NO_COLOR: '1' }, colored: false },
    { name: 'NO_COLOR precedence', env: { FORCE_COLOR: '1', NO_COLOR: '1' }, colored: false },
  ])('formats the Chinese warning with $name using only registry dependencies', async ({ env, colored }) => {
    const result = await runBootstrapFixture([
      '--input-type=module',
      '--eval',
      `
        const { formatNodeVersionWarning } = await import('./bin/nodeVersionWarning.js')
        process.stdout.write(formatNodeVersionWarning('weapp.tailwindcss', '20.19.0', '^22.23.4 || ^24.22.1 || >=26.12.1'))
      `,
    ], env)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('weapp.tailwindcss 检测到当前 Node.js 版本')
    expect(result.stdout).toContain('20.19.0')
    expect(result.stdout).toContain('推荐版本：')
    expect(result.stdout).toContain('^22.23.4 || ^24.22.1 || >=26.12.1')
    expect(result.stdout).toContain('为获得安全修复，建议升级至受支持 LTS 分支的最新补丁版本。')
    expect(result.stdout).toContain('本次将继续运行；若遇到依赖兼容问题，请先升级 Node.js。')
    expect(result.stderr).toBe('')
    expect(stripVTControlCharacters(result.stdout) !== result.stdout).toBe(colored)
  })
})
