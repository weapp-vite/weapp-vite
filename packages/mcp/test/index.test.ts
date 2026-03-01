import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadExposedCatalog } from '@/catalog'
import { runCommand } from '@/commandOps'
import { EXPOSED_PACKAGES } from '@/constants'
import { readFileContent } from '@/fileOps'
import { createWeappViteMcpServer } from '@/server'
import { resolveWorkspaceRoot } from '@/workspace'

const workspaceRoot = resolveWorkspaceRoot(path.resolve(import.meta.dirname, '../..'))

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
})
