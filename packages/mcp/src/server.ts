import type { ExposedPackageId } from './constants'
import fs from 'node:fs/promises'
import path from 'node:path'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadExposedCatalog } from './catalog'
import { runCommand } from './commandOps'
import {
  DEFAULT_MAX_FILE_CHARS,
  DEFAULT_MAX_RESULTS,
  DEFAULT_TIMEOUT_MS,
  EXPOSED_PACKAGES,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
} from './constants'
import { listFilesInDirectory, readFileContent, searchTextInDirectory } from './fileOps'
import { normalizeErrorMessage, toToolError, toToolResult } from './utils'
import { assertInsideRoot, resolveSubPath, resolveWorkspaceRoot } from './workspace'

const packageIds = Object.keys(EXPOSED_PACKAGES) as ExposedPackageId[]
const packageIdSchema = z.enum(packageIds as [ExposedPackageId, ...ExposedPackageId[]])

export interface CreateServerOptions {
  workspaceRoot?: string
}

function resolvePackageRoot(workspaceRoot: string, packageId: ExposedPackageId) {
  return assertInsideRoot(workspaceRoot, path.join(workspaceRoot, EXPOSED_PACKAGES[packageId].relativePath))
}

function toDocsUri(packageId: ExposedPackageId, fileName: string) {
  return `weapp-vite://docs/${packageId}/${fileName}`
}

async function readTextFile(filePath: string) {
  return fs.readFile(filePath, 'utf8')
}

export async function createWeappViteMcpServer(options?: CreateServerOptions) {
  const workspaceRoot = resolveWorkspaceRoot(options?.workspaceRoot)
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  })

  server.registerTool('workspace_catalog', {
    title: 'Workspace Catalog',
    description: '读取 weapp-vite / wevu 相关包目录与脚本能力清单',
  }, async () => {
    try {
      const catalog = await loadExposedCatalog(workspaceRoot)
      return toToolResult({
        workspaceRoot,
        packages: catalog,
      })
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('list_source_files', {
    title: 'List Source Files',
    description: '列出 weapp-vite / wevu 包下指定目录文件列表',
    inputSchema: {
      packageId: packageIdSchema,
      directory: z.string().optional().describe('包内相对目录，默认 src'),
      maxResults: z.number().int().positive().max(2000).optional(),
    },
  }, async ({ packageId, directory, maxResults }) => {
    try {
      const packageRoot = resolvePackageRoot(workspaceRoot, packageId)
      const files = await listFilesInDirectory(packageRoot, directory ?? 'src', maxResults ?? DEFAULT_MAX_RESULTS)
      return toToolResult({
        packageId,
        directory: directory ?? 'src',
        count: files.length,
        files,
      })
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('read_source_file', {
    title: 'Read Source File',
    description: '读取 weapp-vite / wevu 包内源码文件，支持行区间裁剪',
    inputSchema: {
      packageId: packageIdSchema,
      filePath: z.string().describe('包内相对文件路径'),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      maxChars: z.number().int().positive().max(200_000).optional(),
    },
  }, async ({ packageId, filePath, startLine, endLine, maxChars }) => {
    try {
      const packageRoot = resolvePackageRoot(workspaceRoot, packageId)
      const { filePath: absolutePath, content } = await readFileContent(packageRoot, filePath, {
        startLine,
        endLine,
        maxChars: maxChars ?? DEFAULT_MAX_FILE_CHARS,
      })

      return toToolResult({
        packageId,
        filePath,
        absolutePath,
        startLine: startLine ?? null,
        endLine: endLine ?? null,
        content,
      }, content)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('search_source_code', {
    title: 'Search Source Code',
    description: '在 weapp-vite / wevu 代码中搜索关键词',
    inputSchema: {
      query: z.string().min(1),
      packageId: packageIdSchema.optional(),
      directory: z.string().optional(),
      maxResults: z.number().int().positive().max(2000).optional(),
    },
  }, async ({ query, packageId, directory, maxResults }) => {
    try {
      const targetPackageIds = packageId ? [packageId] : packageIds
      const allMatches: Array<{
        packageId: ExposedPackageId
        filePath: string
        line: number
        column: number
        text: string
      }> = []
      const safeMax = maxResults ?? DEFAULT_MAX_RESULTS

      for (const id of targetPackageIds) {
        if (allMatches.length >= safeMax) {
          break
        }
        const packageRoot = resolvePackageRoot(workspaceRoot, id)
        const matches = await searchTextInDirectory(packageRoot, query, {
          relativeDirectory: directory ?? 'src',
          maxResults: safeMax - allMatches.length,
        })
        allMatches.push(...matches.map(match => ({
          packageId: id,
          ...match,
        })))
      }

      return toToolResult({
        query,
        total: allMatches.length,
        matches: allMatches,
      })
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('run_package_script', {
    title: 'Run Package Script',
    description: '在 weapp-vite / wevu 包目录执行 pnpm script',
    inputSchema: {
      packageId: packageIdSchema,
      script: z.string().min(1),
      args: z.array(z.string()).optional(),
      timeoutMs: z.number().int().positive().max(900_000).optional(),
    },
  }, async ({ packageId, script, args, timeoutMs }) => {
    try {
      const cwdRelative = EXPOSED_PACKAGES[packageId].relativePath
      const result = await runCommand(workspaceRoot, 'pnpm', ['run', script, ...(args ?? [])], {
        cwdRelative,
        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('run_weapp_vite_cli', {
    title: 'Run weapp-vite CLI',
    description: '执行 weapp-vite CLI（build/dev/open/analyze 等）',
    inputSchema: {
      subCommand: z.string().min(1),
      projectPath: z.string().optional().describe('相对 workspace 根路径，如 e2e-apps/auto-routes-define-app-json'),
      platform: z.string().optional(),
      args: z.array(z.string()).optional(),
      timeoutMs: z.number().int().positive().max(900_000).optional(),
    },
  }, async ({ subCommand, projectPath, platform, args, timeoutMs }) => {
    try {
      const cliPath = path.join('packages', 'weapp-vite', 'bin', 'weapp-vite.js')
      const finalArgs = [cliPath, subCommand]
      if (projectPath) {
        finalArgs.push(resolveSubPath(workspaceRoot, projectPath))
      }
      if (platform) {
        finalArgs.push('--platform', platform)
      }
      if (Array.isArray(args) && args.length > 0) {
        finalArgs.push(...args)
      }

      const result = await runCommand(workspaceRoot, 'node', finalArgs, {
        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('run_repo_command', {
    title: 'Run Repo Command',
    description: '执行仓库级命令（支持 pnpm/node/git/rg）',
    inputSchema: {
      command: z.enum(['pnpm', 'node', 'git', 'rg']),
      args: z.array(z.string()).optional(),
      cwdRelative: z.string().optional(),
      timeoutMs: z.number().int().positive().max(900_000).optional(),
    },
  }, async ({ command, args, cwdRelative, timeoutMs }) => {
    try {
      const result = await runCommand(workspaceRoot, command, args ?? [], {
        cwdRelative,
        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerPrompt('plan-weapp-vite-change', {
    title: 'Plan weapp-vite Change',
    description: '根据变更目标生成 weapp-vite / wevu 修改计划提示词',
    argsSchema: {
      objective: z.string().min(1),
      focusPackage: packageIdSchema.optional(),
    },
  }, async ({ objective, focusPackage }) => {
    const targets = focusPackage ? [focusPackage] : packageIds
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '你是 weapp-vite monorepo 维护者，请给出可执行的改造计划。',
              `目标：${objective}`,
              `聚焦包：${targets.join(', ')}`,
              '请包含：影响面、风险点、测试策略、回滚策略。',
            ].join('\n'),
          },
        },
      ],
    }
  })

  server.registerPrompt('debug-wevu-runtime', {
    title: 'Debug wevu Runtime',
    description: '用于定位 wevu runtime 生命周期/响应式问题的标准提示词',
    argsSchema: {
      symptom: z.string().min(1),
    },
  }, async ({ symptom }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              '请基于 wevu runtime 代码路径进行分层排查：',
              '1. 复现场景与最小样例',
              '2. 生命周期钩子触发链',
              '3. 响应式与 setData 差量同步链',
              '4. 单测与 e2e 回归补丁',
              `现象：${symptom}`,
            ].join('\n'),
          },
        },
      ],
    }
  })

  server.registerResource('workspace-catalog', 'weapp-vite://workspace/catalog', {
    title: 'Workspace Catalog',
    description: 'weapp-vite / wevu 包目录、版本和脚本列表',
    mimeType: 'application/json',
  }, async () => {
    const catalog = await loadExposedCatalog(workspaceRoot)
    const text = JSON.stringify({ workspaceRoot, packages: catalog }, null, 2)
    return {
      contents: [{
        uri: 'weapp-vite://workspace/catalog',
        mimeType: 'application/json',
        text,
      }],
    }
  })

  const catalog = await loadExposedCatalog(workspaceRoot)
  for (const summary of catalog) {
    if (summary.docs.readme) {
      const uri = toDocsUri(summary.id, 'README.md')
      server.registerResource(`docs-${summary.id}-readme`, uri, {
        title: `${summary.id} README`,
        mimeType: 'text/markdown',
      }, async () => {
        const text = await readTextFile(summary.docs.readme!)
        return {
          contents: [{ uri, mimeType: 'text/markdown', text }],
        }
      })
    }

    if (summary.docs.changelog) {
      const uri = toDocsUri(summary.id, 'CHANGELOG.md')
      server.registerResource(`docs-${summary.id}-changelog`, uri, {
        title: `${summary.id} CHANGELOG`,
        mimeType: 'text/markdown',
      }, async () => {
        const text = await readTextFile(summary.docs.changelog!)
        return {
          contents: [{ uri, mimeType: 'text/markdown', text }],
        }
      })
    }
  }

  const sourceTemplate = new ResourceTemplate('weapp-vite://source/{package}?path={path}', {
    list: undefined,
    complete: {
      package: () => packageIds,
    },
  })

  server.registerResource('source-template', sourceTemplate, {
    title: 'Source Template',
    description: '读取 weapp-vite / wevu 任意源码文件（通过 package + path 参数）',
    mimeType: 'text/plain',
  }, async (uri, variables) => {
    try {
      const packageId = String(variables.package ?? '')
      if (!packageIds.includes(packageId as ExposedPackageId)) {
        throw new Error(`未知 package：${packageId}`)
      }
      const relativePath = decodeURIComponent(String(variables.path ?? ''))
      const packageRoot = resolvePackageRoot(workspaceRoot, packageId as ExposedPackageId)
      const { content } = await readFileContent(packageRoot, relativePath, {
        maxChars: DEFAULT_MAX_FILE_CHARS,
      })
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: content,
        }],
      }
    }
    catch (error) {
      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: `[resource-error] ${normalizeErrorMessage(error)}`,
        }],
      }
    }
  })

  return {
    server,
    workspaceRoot,
  }
}
