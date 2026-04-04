import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { loadExposedCatalog } from '@/catalog'
import { runCommand } from '@/commandOps'
import { EXPOSED_PACKAGES } from '@/constants'
import { resolveExposedPackage } from '@/exposedPackages'
import { readFileContent } from '@/fileOps'
import { createWeappViteMcpServer } from '@/server'
import { resolveWorkspaceRoot } from '@/workspace'

const workspaceRoot = resolveWorkspaceRoot(path.resolve(import.meta.dirname, '../..'))
const tempDirs: string[] = []

async function createInstalledWorkspaceFixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'weapp-vite-mcp-installed-'))
  tempDirs.push(root)

  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
    name: 'fixture-app',
    private: true,
  }, null, 2))

  await fs.mkdir(path.join(root, 'node_modules', 'weapp-vite', 'bin'), { recursive: true })
  await fs.mkdir(path.join(root, 'node_modules', 'weapp-vite', 'dist', 'docs'), { recursive: true })
  await fs.mkdir(path.join(root, 'node_modules', 'wevu'), { recursive: true })
  await fs.mkdir(path.join(root, 'node_modules', '@wevu', 'compiler'), { recursive: true })

  await fs.writeFile(path.join(root, 'node_modules', 'weapp-vite', 'package.json'), JSON.stringify({
    name: 'weapp-vite',
    version: '6.12.4',
    scripts: {
      dev: 'node bin/weapp-vite.js dev',
    },
    bin: {
      'weapp-vite': 'bin/weapp-vite.js',
    },
  }, null, 2))
  await fs.writeFile(path.join(root, 'node_modules', 'weapp-vite', 'bin', 'weapp-vite.js'), 'console.log("fixture weapp-vite cli")\n')
  await fs.writeFile(path.join(root, 'node_modules', 'weapp-vite', 'dist', 'docs', 'README.md'), '# Installed weapp-vite docs\n')

  await fs.writeFile(path.join(root, 'node_modules', 'wevu', 'package.json'), JSON.stringify({
    name: 'wevu',
    version: '6.12.4',
    scripts: {
      build: 'echo build',
    },
  }, null, 2))
  await fs.writeFile(path.join(root, 'node_modules', '@wevu', 'compiler', 'package.json'), JSON.stringify({
    name: '@wevu/compiler',
    version: '6.12.4',
    scripts: {
      build: 'echo build',
    },
  }, null, 2))

  return root
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('catalog', () => {
  it('loads all exposed package summaries', async () => {
    const catalog = await loadExposedCatalog(workspaceRoot)
    expect(catalog.map(item => item.id)).toEqual([
      'weapp-vite',
      'wevu',
      'wevu-compiler',
    ])
    expect(catalog[0]?.packageName).toBeTruthy()
    expect(catalog[0]?.scripts.length).toBeGreaterThan(0)
  })

  it('loads installed-package summaries from node_modules workspaces', async () => {
    const installedWorkspaceRoot = await createInstalledWorkspaceFixture()

    const catalog = await loadExposedCatalog(installedWorkspaceRoot)

    expect(catalog.map(item => item.id)).toEqual([
      'weapp-vite',
      'wevu',
      'wevu-compiler',
    ])
    expect(catalog[0]?.relativePath).toBe(path.join('node_modules', 'weapp-vite'))
    expect(catalog[0]?.docs.readme?.endsWith(path.join('node_modules', 'weapp-vite', 'dist', 'docs', 'README.md'))).toBe(true)
    expect(catalog[1]?.docs.readme).toBeUndefined()
  })
})

describe('file operations', () => {
  it('reads file snippet from package path', async () => {
    const packageRoot = path.join(workspaceRoot, EXPOSED_PACKAGES['weapp-vite'].relativePath)
    const result = await readFileContent(packageRoot, 'README.md', {
      startLine: 1,
      endLine: 6,
    })
    expect(result.content).toContain('Weapp Vite')
  })

  it('rejects path traversal', async () => {
    const packageRoot = path.join(workspaceRoot, EXPOSED_PACKAGES['weapp-vite'].relativePath)
    await expect(readFileContent(packageRoot, '../package.json')).rejects.toThrow('路径越界')
  })
})

describe('command runner', () => {
  it('executes node command with output', async () => {
    const result = await runCommand(workspaceRoot, 'node', ['-e', 'console.log("mcp-ok")'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('mcp-ok')
  })

  it('blocks unsupported commands', async () => {
    await expect(runCommand(workspaceRoot, 'bash', ['-lc', 'echo nope'])).rejects.toThrow('不允许的命令')
  })
})

describe('mcp server registration', () => {
  let server: any

  beforeAll(async () => {
    const created = await createWeappViteMcpServer({ workspaceRoot })
    server = created.server as any
  })

  it('registers core tools', () => {
    const tools = Object.keys(server._registeredTools ?? {})
    expect(tools).toEqual(expect.arrayContaining([
      'workspace_catalog',
      'read_source_file',
      'search_source_code',
      'run_package_script',
      'run_weapp_vite_cli',
      'take_weapp_screenshot',
      'compare_weapp_screenshot',
      'run_repo_command',
    ]))
  })

  it('registers documentation resources', () => {
    const resources = Object.keys(server._registeredResources ?? {})
    expect(resources).toEqual(expect.arrayContaining([
      'weapp-vite://workspace/catalog',
      'weapp-vite://docs/weapp-vite/README.md',
      'weapp-vite://docs/wevu/README.md',
    ]))
  })

  it('creates an MCP server for installed-package workspaces', async () => {
    const installedWorkspaceRoot = await createInstalledWorkspaceFixture()

    const created = await createWeappViteMcpServer({
      workspaceRoot: installedWorkspaceRoot,
    })
    const installedCli = await resolveExposedPackage(installedWorkspaceRoot, 'weapp-vite')
    const registeredResources = Object.keys((created.server as any)._registeredResources ?? {})

    expect(installedCli.cliPath?.endsWith(path.join('node_modules', 'weapp-vite', 'bin', 'weapp-vite.js'))).toBe(true)
    expect(registeredResources).toContain('weapp-vite://docs/weapp-vite/README.md')
  })

  it('resolves installed weapp-vite cli entries for command execution', async () => {
    const installedWorkspaceRoot = await createInstalledWorkspaceFixture()
    const installedCli = await resolveExposedPackage(installedWorkspaceRoot, 'weapp-vite')

    const result = await runCommand(installedWorkspaceRoot, 'node', [installedCli.cliPath!])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('fixture weapp-vite cli')
  })
})
