import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { applyCandidateOverlay, inspectInstallation } from './artifacts.mjs'
import { managerCommand, qualityScripts, requiredCandidates, selectCases, strictEnvironment } from './contracts.mjs'
import { runStep } from './runner.mjs'
import { prepareParentWorkspace, verifyWorkspaceInheritance } from './workspace.mjs'

const roots: string[] = []

async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vite-plus-consumer-contract-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('Vite+ packed template consumer contracts', () => {
  it('keeps seven pnpm templates, one npm template and one workspace case in the complete matrix', () => {
    const { matrix, selected } = selectCases()
    expect(selected).toEqual(matrix)
    expect(matrix.map(item => item.id)).toEqual([
      'pnpm/default',
      'pnpm/wevu',
      'pnpm/tailwindcss',
      'pnpm/tdesign',
      'pnpm/wevu-tdesign',
      'pnpm/vant',
      'pnpm/react',
      'npm/default',
      'pnpm/workspace',
    ])
    expect(selectCases('npm/default').selected.map(item => item.id)).toEqual(['npm/default'])
    expect(selectCases('npm/default').matrix).toHaveLength(9)
    expect(() => selectCases('')).toThrow('cannot be empty')
    expect(() => selectCases('npm/react')).toThrow('Unknown')
  })

  it('requires every generated quality script and includes the Vue-specific check when present', () => {
    const scripts = Object.fromEntries(['lint', 'format:check', 'check', 'stylelint', 'build'].map(name => [name, name]))
    expect(qualityScripts({ scripts })).toEqual(['lint', 'format:check', 'check', 'stylelint', 'build'])
    expect(qualityScripts({ scripts: { ...scripts, 'lint:vue': 'eslint' } })).toEqual(['lint', 'format:check', 'check', 'lint:vue', 'stylelint', 'build'])
    expect(() => qualityScripts({ scripts: { ...scripts, check: undefined } })).toThrow('Missing generated script: check')
  })

  it('forces strict peers, engines and lifecycle scripts without inheriting repository preload hooks', async () => {
    const cache = await temporaryRoot()
    const env = strictEnvironment('https://registry.npmjs.org/', cache, { NODE_OPTIONS: '--import=repo-hook.mjs', NODE_PATH: 'repo/node_modules', npm_config_legacy_peer_deps: 'true', NPM_CONFIG_IGNORE_SCRIPTS: 'true' })
    expect(env).toMatchObject({ npm_config_strict_peer_deps: 'true', npm_config_legacy_peer_deps: 'false', npm_config_engine_strict: 'true', NPM_CONFIG_IGNORE_SCRIPTS: 'false' })
    expect(env).not.toHaveProperty('NODE_OPTIONS')
    expect(env).not.toHaveProperty('NODE_PATH')
    const command = managerCommand('pnpm', ['run', 'format:check'], 'https://registry.npmjs.org/', cache)
    expect(command.command).toBe('corepack')
    expect(command.args).toContain('--config.strict-peer-dependencies=true')
    expect(command.args).toContain('--config.enable-global-virtual-store=false')
    expect(command.args.slice(-2)).toEqual(['run', 'format:check'])
  })

  it.each(['npm', 'pnpm'])('restores original %s metadata byte-for-byte before format checks', async (manager) => {
    const root = await temporaryRoot()
    const candidate = { name: '@weapp-vite/oxlint', tarball: path.join(root, 'candidate with spaces.tgz') }
    const filename = path.join(root, manager === 'npm' ? 'package.json' : 'pnpm-workspace.yaml')
    const original = manager === 'npm'
      ? '{"devDependencies":{"@weapp-vite/oxlint":"^0.1.0"},"overrides":{"vite":"npm:core@1.2.0"}}\n'
      : '# owned generated policy\npackages: []\noverrides:\n  vite: npm:core@1.2.0\n'
    await fs.writeFile(filename, original)
    const restore = await applyCandidateOverlay(root, manager, [candidate])
    const modified = await fs.readFile(filename, 'utf8')
    if (manager === 'npm') {
      const manifest = JSON.parse(modified) as { devDependencies: Record<string, string>, overrides: Record<string, string> }
      expect(manifest.devDependencies[candidate.name]).toBe(`file:${candidate.tarball.replaceAll('\\', '/')}`)
      expect(manifest.overrides).toMatchObject({ 'vite': 'npm:core@1.2.0', '@weapp-vite/oxlint': '$@weapp-vite/oxlint' })
    }
    else {
      const document = parse(modified) as { overrides: Record<string, string> }
      expect(document.overrides).toMatchObject({ 'vite': 'npm:core@1.2.0', '@weapp-vite/oxlint': `file:${candidate.tarball.replaceAll('\\', '/')}` })
    }
    await restore()
    expect(await fs.readFile(filename, 'utf8')).toBe(original)
  })

  it('requires installed candidate identities and lockfile integrity while rejecting links outside the consumer', async () => {
    const root = await temporaryRoot()
    const artifacts = requiredCandidates.map((name: string) => ({ name, version: '0.1.0', integrity: `sha512-fixture-${name}` }))
    for (const artifact of artifacts) {
      const directory = path.join(root, 'node_modules', artifact.name)
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: artifact.name, version: artifact.version }))
    }
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), artifacts.map((artifact: { integrity: string }) => artifact.integrity).join('\n'))
    expect(await inspectInstallation(root, artifacts, 'pnpm')).toMatchObject({ links: 0, candidates: artifacts.map(({ name, version }: { name: string, version: string }) => ({ name, version, installed: true })) })
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), '')
    await expect(inspectInstallation(root, artifacts, 'pnpm')).rejects.toThrow('tarball integrity')
    const external = await temporaryRoot()
    await fs.symlink(external, path.join(root, 'node_modules', 'external'), 'junction')
    await expect(inspectInstallation(root, artifacts, 'pnpm')).rejects.toThrow('escapes isolated consumer')
  })

  it('does not classify unrelated command failures or unexpected success as a successful negative control', async () => {
    const root = await temporaryRoot()
    const context = { id: 'pnpm/workspace', reportRoot: root, privateRoots: [root], timeoutMs: 1000, steps: [] as Array<{ status: string, exitCode: number | null }>, flush: vi.fn() }
    await runStep(context, 'root-rule', {}, 'workspace-root-rule-probe', async () => {
      throw new Error('Command failed with code 1 signal null\nworkspace-root-rule-probe')
    })
    expect(context.steps[0]).toMatchObject({ status: 'passed', exitCode: 1 })
    await expect(runStep(context, 'unexpected-success', {}, 'workspace-root-rule-probe', async () => ({ stdout: '', stderr: '' }))).rejects.toThrow('Expected diagnostic')
    await expect(runStep(context, 'unrelated-failure', {}, 'workspace-root-rule-probe', async () => {
      throw new Error('Command failed with code 1 signal null\nMODULE_NOT_FOUND')
    })).rejects.toThrow('MODULE_NOT_FOUND')
  })

  it('derives parent policy from generated output and restores workspace probes on failure', async () => {
    const root = await temporaryRoot()
    const seed = path.join(root, 'seed')
    const project = path.join(root, 'apps/mini')
    await fs.mkdir(seed)
    await fs.mkdir(path.join(project, 'src'), { recursive: true })
    await fs.writeFile(path.join(seed, 'package.json'), JSON.stringify({ devDependencies: { 'vite-plus': '1.2.0', 'vite': 'npm:core@1.2.0', '@weapp-vite/oxfmt': '0.1.0' } }))
    await fs.writeFile(path.join(seed, 'pnpm-workspace.yaml'), 'packages: []\nallowBuilds:\n  rolldown: true\noverrides:\n  vite: npm:core@1.2.0\n')
    const verifyParent = await prepareParentWorkspace(root, seed)
    await verifyParent()
    const before = await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')
    const calls: string[] = []
    await expect(verifyWorkspaceInheritance(root, project, async (_script: string, stage: string) => {
      calls.push(stage)
      if (stage === 'workspace-root-format') {
        throw new Error('probe failed')
      }
    })).rejects.toThrow('probe failed')
    expect(calls).toEqual(['workspace-member-lint', 'workspace-root-lint', 'workspace-member-format', 'workspace-root-format'])
    expect(await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')).toBe(before)
    await expect(fs.stat(path.join(project, 'src/workspace-policy-probe.ts'))).rejects.toMatchObject({ code: 'ENOENT' })
    await fs.appendFile(path.join(root, 'vite.config.ts'), '// changed\n')
    await expect(verifyParent()).rejects.toThrow('Scaffold modified parent workspace')
  })
})
