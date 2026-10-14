import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { expect, it } from 'vitest'

const packageDir = path.resolve(import.meta.dirname, '..')
const executeFile = promisify(execFile)
const tsdownCli = fileURLToPath(import.meta.resolve('tsdown/run'))

interface PackageManifest {
  name: string
  version: string
  main: string
  module: string
  types: string
  dependencies: Record<string, string>
  exports: {
    '.': {
      import: string
      types: string
    }
  }
}

async function linkDependencies(artifactRoot: string, dependencies: Record<string, string>) {
  for (const name of Object.keys(dependencies)) {
    let dependencyRoot: string | undefined
    for (let lookupRoot = packageDir; ; lookupRoot = path.dirname(lookupRoot)) {
      const candidate = path.join(lookupRoot, 'node_modules', name)
      try {
        await access(path.join(candidate, 'package.json'))
        dependencyRoot = await realpath(candidate)
        break
      }
      catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
          throw error
        }
      }
      if (lookupRoot === path.dirname(lookupRoot)) {
        break
      }
    }
    if (!dependencyRoot) {
      throw new Error(`找不到产物测试依赖：${name}`)
    }
    const destination = path.join(artifactRoot, 'node_modules', name)
    await mkdir(path.dirname(destination), { recursive: true })
    await symlink(dependencyRoot, destination, process.platform === 'win32' ? 'junction' : 'dir')
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      return false
    }
    throw error
  }
}

async function createWorkspace(workspaceRoot: string) {
  await mkdir(workspaceRoot, { recursive: true })
  await writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ private: true }))
  await writeFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n')

  for (const [directory, name] of [
    ['packages/weapp-vite', 'weapp-vite'],
    ['packages-runtime/wevu', 'wevu'],
    ['packages-runtime/wevu-compiler', '@wevu/compiler'],
  ]) {
    const packageRoot = path.join(workspaceRoot, directory)
    await mkdir(packageRoot, { recursive: true })
    await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
      name,
      version: '1.0.0',
      scripts: { build: 'build' },
    }))
  }
}

it.each(['direct', 'linked'] as const)('runs the published entry through a %s path and serves the MCP protocol', async (entryKind) => {
  const temporaryRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-mcp-artifact-')))
  const artifactRoot = path.join(temporaryRoot, 'package')
  const workspaceRoot = path.join(temporaryRoot, 'workspace')
  try {
    const manifest = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8')) as PackageManifest
    const publicEntry = path.resolve(artifactRoot, manifest.exports['.'].import)
    const declaration = path.resolve(artifactRoot, manifest.exports['.'].types)

    await mkdir(artifactRoot, { recursive: true })
    await linkDependencies(artifactRoot, manifest.dependencies)
    await executeFile(process.execPath, [
      tsdownCli,
      '--config',
      path.join(packageDir, 'tsdown.config.ts'),
      '--out-dir',
      path.join(artifactRoot, 'dist'),
    ], { cwd: packageDir, timeout: 45_000, maxBuffer: 2 * 1024 * 1024 })

    expect(manifest.main).toBe(manifest.exports['.'].import)
    expect(manifest.module).toBe(manifest.exports['.'].import)
    expect(manifest.types).toBe(manifest.exports['.'].types)
    await Promise.all([access(publicEntry), access(declaration)])
    expect(await readFile(declaration, 'utf8')).toContain('startStdioServer')
    await createWorkspace(workspaceRoot)

    const consumer = path.join(artifactRoot, 'consumer.mjs')
    await writeFile(consumer, `
import assert from 'node:assert/strict'
import { startStdioServer } from ${JSON.stringify(pathToFileURL(publicEntry).href)}
assert.equal(typeof startStdioServer, 'function')
`)
    const imported = await executeFile(process.execPath, [consumer], { cwd: workspaceRoot, timeout: 5000 })
    expect(imported.stdout).toBe('')
    expect(imported.stderr).toBe('')

    let entry = publicEntry
    if (entryKind === 'linked') {
      const linkedRoot = path.join(temporaryRoot, 'linked-package')
      await symlink(artifactRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
      entry = path.resolve(linkedRoot, manifest.exports['.'].import)
    }

    const client = new Client({ name: 'mcp-build-artifact-test', version: '1.0.0' }, {
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      cwd: workspaceRoot,
      stderr: 'pipe',
    })
    let stderr = ''
    let childPid: number | null = null
    transport.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })

    try {
      try {
        await client.connect(transport, { timeout: 5000 })
      }
      catch (error) {
        throw new Error(`MCP 产物连接失败\n${stderr}`, { cause: error })
      }
      childPid = transport.pid
      expect(childPid).not.toBeNull()
      expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28')
      expect(client.getServerVersion()).toMatchObject({ name: manifest.name, version: manifest.version })
      expect(client.getServerCapabilities()?.tools).toBeDefined()
      const { tools } = await client.listTools(undefined, { timeout: 5000 })
      expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
        'workspace_catalog',
        'read_source_file',
        'weapp_devtools_connect',
      ]))

      const catalog = await client.callTool({ name: 'workspace_catalog', arguments: {} }, { timeout: 5000 })
      expect(catalog.isError).not.toBe(true)
      const text = catalog.content.find(item => item.type === 'text')
      expect(text?.type).toBe('text')
      if (text?.type !== 'text') {
        throw new Error('workspace_catalog 未返回文本结果')
      }
      const result: unknown = JSON.parse(text.text)
      expect(result).toMatchObject({
        workspaceRoot,
        packages: [
          { id: 'weapp-vite', packageName: 'weapp-vite', version: '1.0.0' },
          { id: 'wevu', packageName: 'wevu', version: '1.0.0' },
          { id: 'wevu-compiler', packageName: '@wevu/compiler', version: '1.0.0' },
        ],
      })
      expect(stderr).toBe('')
    }
    finally {
      childPid ??= transport.pid
      try {
        await client.close()
      }
      finally {
        await transport.close()
      }
      expect(transport.pid).toBeNull()
      if (childPid !== null) {
        const pid = childPid
        await expect.poll(() => isProcessAlive(pid), { timeout: 2000 }).toBe(false)
      }
    }
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}, 75_000)
