import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverPackageSkills, discoverPublicSkillSources, discoverWorkspacePackages } from '../../skills/scripts/package-skills.mjs'

const execFileAsync = promisify(execFile)
const owned: string[] = []

afterEach(async () => {
  await Promise.all(owned.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function write(root: string, relative: string, content: string) {
  const file = path.join(root, relative)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
}

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-skills-'))
  owned.push(root)
  await write(root, 'pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - "!packages/excluded/**"\n')
  return root
}

describe('package-local skill discovery', () => {
  it('discovers the committed owner for every published consumer skill', async () => {
    const packages = await discoverPackageSkills()
    expect(Object.fromEntries(packages.map(pkg => [pkg.name, pkg.skills]))).toEqual({
      'weapp-vite': ['weapp-vite-best-practices', 'weapp-vite-vue-sfc-best-practices'],
      'wevu': ['wevu-best-practices'],
      '@weapp-vite/react': ['weapp-vite-react-best-practices'],
      '@wevu/json-render': ['wevu-json-render-best-practices'],
      '@wevu/a2ui': ['wevu-a2ui-best-practices'],
    })
    const sources = await discoverPublicSkillSources()
    expect(sources).toHaveLength(11)
    expect(new Set(sources.map(source => source.name)).size).toBe(sources.length)
    expect(sources.filter(source => !source.owner).map(source => source.name).sort()).toEqual([
      'docs-and-website-sync',
      'native-to-weapp-vite-wevu-migration',
      'release-and-changeset-best-practices',
      'weapp-acceptance',
      'weapp-devtools-e2e-best-practices',
    ])
  })

  it('follows workspace patterns and keeps repository and package sources distinct', async () => {
    const root = await workspace()
    await write(root, 'skills/repository/SKILL.md', '# Repository\n')
    await write(root, 'packages/library/package.json', '{"name":"@scope/library","files":["skills"]}\n')
    await write(root, 'packages/library/skills/package-guide/SKILL.md', '# Package\n')
    await write(root, 'packages/library/skills/package-guide/agents/openai.yaml', 'interface: {}\n')
    await write(root, 'packages/empty/package.json', '{"name":"empty"}\n')
    await write(root, 'packages/excluded/package.json', '{"name":"excluded"}\n')
    await write(root, 'packages/excluded/skills/ignored/SKILL.md', '# Ignored\n')

    expect((await discoverWorkspacePackages(root)).map(pkg => pkg.manifest.name).sort()).toEqual(['@scope/library', 'empty'])
    expect((await discoverPackageSkills(root)).map(pkg => [pkg.name, pkg.skills])).toEqual([
      ['@scope/library', ['package-guide']],
    ])
    expect(await discoverPublicSkillSources(root)).toEqual([
      { name: 'package-guide', directory: 'packages/library/skills/package-guide', owner: '@scope/library' },
      { name: 'repository', directory: 'skills/repository', owner: null },
    ])
  })

  it('expands directory and wildcard negative workspace patterns', async () => {
    const root = await workspace()
    await write(root, 'pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - fixtures/*\n  - "!packages/excluded"\n  - "!fixtures/excluded-*"\n')
    await write(root, 'packages/library/package.json', '{"name":"library"}\n')
    await write(root, 'packages/excluded/package.json', '{ invalid json')
    await write(root, 'fixtures/excluded-generated/package.json', '{ invalid json')

    expect((await discoverWorkspacePackages(root)).map(pkg => pkg.manifest.name)).toEqual(['library'])
  })

  it('ignores generated package skills outside the committed source', async () => {
    const root = await workspace()
    await write(root, '.gitignore', 'packages/generated/skills/\n')
    await write(root, 'skills/shared/SKILL.md', '# Repository\n')
    await write(root, 'packages/committed/package.json', '{"name":"committed","files":["skills"]}\n')
    await write(root, 'packages/committed/skills/shared/SKILL.md', '# Committed\n')
    await write(root, 'packages/generated/package.json', '{"name":"generated","files":["skills"]}\n')
    await write(root, 'packages/generated/skills/shared/SKILL.md', '# Generated\n')
    await execFileAsync('git', ['init', '--quiet'], { cwd: root })
    await execFileAsync('git', ['add', '--', '.gitignore', 'skills/shared/SKILL.md', 'packages/committed'], { cwd: root })

    expect((await discoverPackageSkills(root)).map(pkg => [pkg.name, pkg.skills])).toEqual([
      ['committed', ['shared']],
    ])
    expect(await discoverPublicSkillSources(root)).toEqual([
      { name: 'shared', directory: 'skills/shared', owner: null },
      { name: 'shared', directory: 'packages/committed/skills/shared', owner: 'committed' },
    ])
  })

  it('preserves duplicate names so contract validation can reject ambiguous ownership', async () => {
    const root = await workspace()
    await write(root, 'skills/shared/SKILL.md', '# Repository\n')
    await write(root, 'packages/library/package.json', '{"name":"library"}\n')
    await write(root, 'packages/library/skills/shared/SKILL.md', '# Package\n')
    const sources = await discoverPublicSkillSources(root)
    expect(sources.filter(source => source.name === 'shared')).toHaveLength(2)
  })
})
