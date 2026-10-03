import type { PackageJson } from 'pkg-types'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { createProject, TemplateName } from '@/index'

const roots: string[] = []

async function generate(template: TemplateName, toolchain: 'wv' | 'vite' | 'vite-plus') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-toolchain-'))
  roots.push(root)
  await createProject(root, template, { toolchain })
  return { root, pkg: await fs.readJSON(path.join(root, 'package.json')) as PackageJson }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

describe('scaffold toolchain selection', () => {
  it.each([TemplateName.default, TemplateName.wevu, TemplateName.react])('keeps %s independent from native Vite selection', async (template) => {
    const { root, pkg } = await generate(template, 'vite')
    expect(pkg.scripts?.dev).toBe('vite dev')
    expect(pkg.scripts?.build).toBe('vite build')
    if (template !== TemplateName.react) {
      expect(pkg.scripts?.['build:web']).toBe('vite build --config vite.web.config.ts')
      expect(await fs.readFile(path.join(root, 'vite.web.config.ts'), 'utf8')).toContain('platform: \'web\'')
      expect(pkg.scripts?.open).toBe('wv open')
    }
    expect(pkg.scripts?.postinstall).toBe('wv prepare')
    expect(pkg.scripts?.['dev:open']).toBe('wv dev -o')
    expect(pkg.scripts?.lint).toBe('eslint .')
    expect(pkg.scripts?.stylelint).toContain('stylelint')
    expect(pkg.devDependencies?.vite).toBeTruthy()
    expect(await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')).toContain('from \'./weapp-vite.config\'')
  })

  it('pins Vite+ core consistently for direct and transitive consumers', async () => {
    const { root, pkg } = await generate(TemplateName.default, 'vite-plus')
    const workspace = parse(await fs.readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as { overrides: Record<string, string>, allowBuilds: Record<string, boolean>, peerDependencyRules: { allowedVersions: Record<string, string> } }
    expect(pkg.scripts?.dev).toBe('vp dev')
    expect(pkg.scripts?.build).toBe('vp build')
    const version = pkg.devDependencies?.['vite-plus']
    expect(version).toBeTruthy()
    expect(pkg.devDependencies?.vite).toBe(`npm:@voidzero-dev/vite-plus-core@${version}`)
    expect(pkg.overrides?.vite).toBe(pkg.devDependencies?.vite)
    expect(workspace.overrides.vite).toBe(pkg.devDependencies?.vite)
    expect(workspace.overrides.vitest).toBe('5.0.1')
    expect(pkg.overrides?.vitest).toBe('5.0.1')
    expect(workspace.peerDependencyRules.allowedVersions).toEqual({ vite: '1.0.0' })
    expect(workspace.allowBuilds.rolldown).toBe(true)
    expect(pkg.engines?.node).toBe('^24.15.0 || >=26.0.0')
    expect(await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')).toContain('from \'vite-plus\'')
  })

  it.each(['wv', 'vite', 'vite-plus'] as const)('generates platform scripts and explicit native host targets for %s', async (toolchain) => {
    const { root, pkg } = await generate(TemplateName.multiPlatform, toolchain)
    for (const platform of ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'web']) {
      const host = toolchain === 'vite-plus' ? 'vp' : toolchain
      for (const action of ['dev', 'build']) {
        const suffix = action === 'dev' && platform === 'web' ? ' --host' : ''
        expect(pkg.scripts?.[`${action}:${platform}`]).toBe(toolchain === 'wv'
          ? `wv ${action} -p ${platform}${suffix}`
          : `${host} ${action} --config vite.${platform}.config.ts${suffix}`)
      }
      if (toolchain !== 'wv') {
        const config = await fs.readFile(path.join(root, `vite.${platform}.config.ts`), 'utf8')
        expect(config).toContain(`platform: '${platform}'`)
        expect(config).toContain(`enable: ${platform === 'web'}`)
        expect(config).toContain(`from '${toolchain}'`)
      }
    }
    expect(pkg.scripts?.postinstall).toBe('wv prepare -p weapp')
    expect(pkg.scripts?.['dev:open']).toBe('wv dev -p weapp -o')
    expect(await fs.readFile(path.join(root, toolchain === 'wv' ? 'vite.config.ts' : 'weapp-vite.config.ts'), 'utf8')).toContain('multiPlatform:')
  })

  it('wraps the existing library configuration and preserves the wv default', async () => {
    const native = await generate(TemplateName.lib, 'vite')
    expect(native.pkg.scripts?.['build:lib']).toBe('vite build --config vite.lib.config.ts')
    expect(await fs.readFile(path.join(native.root, 'vite.lib.config.ts'), 'utf8')).toContain('from \'./weapp-vite.lib.config\'')
    const legacy = await generate(TemplateName.default, 'wv')
    expect(legacy.pkg.scripts?.build).toBe('wv build')
    expect(await fs.pathExists(path.join(legacy.root, 'vite.config.ts'))).toBe(false)
  })

  it('requires the matching runner in a parent workspace and preserves its existing policy', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-toolchain-runner-'))
    roots.push(root)
    const workspaceFile = path.join(root, 'pnpm-workspace.yaml')
    const workspace = 'packages:\n  - apps/*\noverrides:\n  vite: npm:@voidzero-dev/vite-plus-core@1.0.0\n'
    await fs.writeFile(workspaceFile, workspace)
    const target = path.join(root, 'apps/demo')
    await expect(createProject(target, TemplateName.default, { toolchain: 'vite-plus' })).rejects.toThrow('overrides.vitest')
    expect(await fs.pathExists(target)).toBe(false)
    const runnerConfigured = `${workspace}  vitest: 5.0.1\n`
    await fs.writeFile(workspaceFile, runnerConfigured)
    await expect(createProject(target, TemplateName.default, { toolchain: 'vite-plus' })).rejects.toThrow('peerDependencyRules.allowedVersions.vite')
    expect(await fs.pathExists(target)).toBe(false)
    expect(await fs.readFile(workspaceFile, 'utf8')).toBe(runnerConfigured)
    const peerPolicy = 'peerDependencyRules:\n  allowedVersions:\n    vite: '
    await fs.writeFile(workspaceFile, `${runnerConfigured}${peerPolicy}^8.0.0\n`)
    await expect(createProject(target, TemplateName.default, { toolchain: 'vite-plus' })).rejects.toThrow('peerDependencyRules.allowedVersions.vite')
    expect(await fs.pathExists(target)).toBe(false)
    const configured = `${runnerConfigured}${peerPolicy}1.0.0 || ^8.0.0\n`
    await fs.writeFile(workspaceFile, configured)
    await createProject(target, TemplateName.default, { toolchain: 'vite-plus' })
    expect(await fs.readFile(workspaceFile, 'utf8')).toBe(configured)
    expect(await fs.pathExists(path.join(target, 'pnpm-workspace.yaml'))).toBe(false)
  })

  it('rejects a conflicting parent workspace before creating a Vite+ member', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-toolchain-workspace-'))
    roots.push(root)
    const workspace = 'packages:\n  - apps/*\noverrides:\n  vite: 8.3.2\n'
    await fs.writeFile(path.join(root, 'pnpm-workspace.yaml'), workspace)
    const target = path.join(root, 'apps/demo')
    await expect(createProject(target, TemplateName.default, { toolchain: 'vite-plus' })).rejects.toThrow('overrides.vite')
    expect(await fs.pathExists(target)).toBe(false)
    expect(await fs.readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')).toBe(workspace)
  })
})
