import type { ExposedPackageId } from './constants'
import fs from 'node:fs/promises'
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
import { resolveExposedPackage, resolveExposedPackages } from './exposedPackages'
import { listFilesInDirectory, readFileContent, searchTextInDirectory } from './fileOps'
import { normalizeErrorMessage, toToolError, toToolResult } from './utils'
import { assertInsideRoot, resolveSubPath, resolveWorkspaceRoot } from './workspace'

const packageIds = Object.keys(EXPOSED_PACKAGES) as ExposedPackageId[]
const packageIdSchema = z.enum(packageIds as [ExposedPackageId, ...ExposedPackageId[]])

export interface CreateServerOptions {
  workspaceRoot?: string
}

async function resolvePackageRoot(workspaceRoot: string, packageId: ExposedPackageId) {
  const resolved = await resolveExposedPackage(workspaceRoot, packageId)
  if (!resolved.sourceRoot) {
    throw new Error(`当前工作区中的 ${packageId} 不包含源码目录，请改为优先读取本地随包文档。`)
  }
  return assertInsideRoot(workspaceRoot, resolved.sourceRoot)
}

function toDocsUri(packageId: ExposedPackageId, fileName: string) {
  return `weapp-vite://docs/${packageId}/${fileName}`
}

async function readTextFile(filePath: string) {
  return fs.readFile(filePath, 'utf8')
}

async function runWeappViteCliTool(
  workspaceRoot: string,
  input: {
    subCommand: string
    projectPath?: string
    platform?: string
    args?: string[]
    timeoutMs?: number
  },
) {
  const cliPath = (await resolveExposedPackage(workspaceRoot, 'weapp-vite')).cliPath
  if (!cliPath) {
    throw new Error('当前工作区中的 weapp-vite 未暴露 CLI 入口')
  }

  const finalArgs = [cliPath, input.subCommand]
  if (input.projectPath) {
    finalArgs.push(resolveSubPath(workspaceRoot, input.projectPath))
  }
  if (input.platform) {
    finalArgs.push('--platform', input.platform)
  }
  if (Array.isArray(input.args) && input.args.length > 0) {
    finalArgs.push(...input.args)
  }

  return runCommand(workspaceRoot, 'node', finalArgs, {
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
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
      const packageRoot = await resolvePackageRoot(workspaceRoot, packageId)
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
      const packageRoot = await resolvePackageRoot(workspaceRoot, packageId)
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
        const packageRoot = await resolvePackageRoot(workspaceRoot, id)
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
      const resolvedPackage = await resolveExposedPackage(workspaceRoot, packageId)
      const result = await runCommand(workspaceRoot, 'pnpm', ['run', script, ...(args ?? [])], {
        cwdRelative: resolvedPackage.relativePath,
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
      const result = await runWeappViteCliTool(workspaceRoot, {
        subCommand,
        projectPath,
        platform,
        args,
        timeoutMs,
      })
      return toToolResult(result)
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('take_weapp_screenshot', {
    title: 'Take Weapp Screenshot',
    description: '当用户提到截图、页面快照、运行时截图时，优先调用此工具执行 weapp-vite screenshot',
    inputSchema: {
      projectPath: z.string().describe('相对 workspace 根路径，通常是 dist/build/mp-weixin 或具体小程序项目目录'),
      page: z.string().optional().describe('截图前先跳转的小程序页面路径'),
      outputPath: z.string().optional().describe('截图输出路径，建议写入 .tmp/ 或工作区相对路径'),
      timeoutMs: z.number().int().positive().max(900_000).optional(),
    },
  }, async ({ projectPath, page, outputPath, timeoutMs }) => {
    try {
      const args = ['--json']
      if (page) {
        args.push('--page', page)
      }
      if (outputPath) {
        args.push('--output', outputPath)
      }
      const result = await runWeappViteCliTool(workspaceRoot, {
        subCommand: 'screenshot',
        projectPath,
        args,
        timeoutMs,
      })
      return toToolResult({
        ...result,
        projectPath,
        page: page ?? null,
        outputPath: outputPath ?? null,
        recommendedIntent: 'screenshot',
      })
    }
    catch (error) {
      return toToolError(error)
    }
  })

  server.registerTool('compare_weapp_screenshot', {
    title: 'Compare Weapp Screenshot',
    description: '当用户提到截图对比、diff、baseline、视觉回归、像素对比时，优先调用此工具执行 weapp-vite compare',
    inputSchema: {
      projectPath: z.string().describe('相对 workspace 根路径，通常是 dist/build/mp-weixin 或具体小程序项目目录'),
      baselinePath: z.string().describe('相对 workspace 根路径的 baseline 图片路径'),
      page: z.string().optional().describe('截图对比前先跳转的小程序页面路径'),
      currentOutputPath: z.string().optional().describe('当前截图输出路径'),
      diffOutputPath: z.string().optional().describe('diff 图片输出路径'),
      threshold: z.number().min(0).max(1).optional(),
      maxDiffPixels: z.number().int().min(0).optional(),
      maxDiffRatio: z.number().min(0).max(1).optional(),
      timeoutMs: z.number().int().positive().max(900_000).optional(),
    },
  }, async ({ projectPath, baselinePath, page, currentOutputPath, diffOutputPath, threshold, maxDiffPixels, maxDiffRatio, timeoutMs }) => {
    try {
      const args = ['--json', '--baseline', baselinePath]
      if (page) {
        args.push('--page', page)
      }
      if (currentOutputPath) {
        args.push('--current-output', currentOutputPath)
      }
      if (diffOutputPath) {
        args.push('--diff-output', diffOutputPath)
      }
      if (threshold != null) {
        args.push('--threshold', String(threshold))
      }
      if (maxDiffPixels != null) {
        args.push('--max-diff-pixels', String(maxDiffPixels))
      }
      if (maxDiffRatio != null) {
        args.push('--max-diff-ratio', String(maxDiffRatio))
      }

      const result = await runWeappViteCliTool(workspaceRoot, {
        subCommand: 'compare',
        projectPath,
        args,
        timeoutMs,
      })
      return toToolResult({
        ...result,
        projectPath,
        baselinePath,
        page: page ?? null,
        currentOutputPath: currentOutputPath ?? null,
        diffOutputPath: diffOutputPath ?? null,
        recommendedIntent: 'compare',
      })
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

  const catalog = await resolveExposedPackages(workspaceRoot)
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
      const packageRoot = await resolvePackageRoot(workspaceRoot, packageId as ExposedPackageId)
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
