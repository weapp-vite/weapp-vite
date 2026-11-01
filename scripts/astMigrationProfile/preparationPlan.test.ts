import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compilerCases } from './cases'
import { assertProjectPreparation, createPreparationPlan } from './preparationPlan'

describe('real compiler preparation plan', () => {
  it('orders locked release native, forced serial closure, then one built CLI prepare per real project', () => {
    const plan = createPreparationPlan(compilerCases)
    expect(plan).toHaveLength(7)
    expect(plan[0]).toEqual({ phase: 'native', command: 'pnpm', args: ['--filter', '@weapp-vite/ast-native', 'native:build'], cwd: '.' })
    expect(plan[1]).toEqual({ phase: 'closure', command: 'pnpm', args: ['exec', 'turbo', 'run', 'build', '--filter=weapp-vite...', '--filter=@wevu/compiler...', '--force', '--concurrency=1'], cwd: '.' })
    const projects = plan.slice(2)
    expect(new Set(projects.map(command => command.cwd)).size).toBe(5)
    expect(projects.map(command => command.cwd)).toEqual([...new Set(compilerCases.map(fixture => fixture.project))])
    for (const command of projects) {
      expect(command.phase).toBe('project-support')
      expect(command.command).toBe('node')
      expect(path.posix.normalize(path.posix.join(command.cwd, command.args[0]!))).toBe('packages/weapp-vite/dist/cli.mjs')
      expect(command.args.slice(1)).toEqual(['prepare', '--config', compilerCases.find(fixture => fixture.project === command.cwd)!.config, '--platform', 'weapp'])
    }
  })

  it('delegates the Cargo lock flag to the real native package script exactly once', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../packages/ast-native/package.json', import.meta.url), 'utf8')) as {
      name: string
      scripts: Record<string, string>
    }
    const native = createPreparationPlan(compilerCases)[0]!
    expect(native.args.slice(0, 3)).toEqual(['--filter', manifest.name, 'native:build'])
    const scriptArgs = manifest.scripts['native:build']!.trim().split(/\s+/)
    expect(scriptArgs.slice(0, 2)).toEqual(['napi', 'build'])
    expect(scriptArgs).toContain('--release')
    const separator = scriptArgs.indexOf('--')
    expect(separator).toBeGreaterThan(-1)
    const packageCargoArgs = scriptArgs.slice(separator + 1)
    expect(packageCargoArgs).toContain('--locked')
    const cargoArgs = [...packageCargoArgs, ...native.args.slice(3)]
    expect(cargoArgs.filter(argument => argument === '--locked')).toHaveLength(1)
  })

  it('rejects two configs for the same preparation project', () => {
    const fixture = compilerCases[0]!
    expect(() => createPreparationPlan([fixture, { ...fixture, config: 'other.config.ts' }])).toThrow('Conflicting project config')
  })

  it('does not accept permissive CLI exits that skipped or only partly prepared support files', () => {
    const command = createPreparationPlan(compilerCases)[2]!
    expect(() => assertProjectPreparation(command, '', '')).toThrow('did not complete')
    expect(() => assertProjectPreparation(command, '已生成 .weapp-vite 支持文件。', '[prepare] 跳过 .weapp-vite 支持文件预生成：boom')).toThrow('did not complete')
    expect(() => assertProjectPreparation(command, '已生成 .weapp-vite 支持文件。', '')).not.toThrow()
  })
})
