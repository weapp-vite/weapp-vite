import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ExposedPackageId } from '../constants'
import { z } from 'zod'
import { loadExposedCatalog } from '../catalog'
import { runCommand } from '../commandOps'
import {
  DEFAULT_MAX_FILE_CHARS,
  DEFAULT_MAX_RESULTS,
  DEFAULT_TIMEOUT_MS,
} from '../constants'
import { resolveExposedPackage } from '../exposedPackages'
import { listFilesInDirectory, readFileContent, searchTextInDirectory } from '../fileOps'
import { toToolError, toToolResult } from '../utils'
import { resolvePackageRoot, runWeappViteCliTool } from './shared'

export function registerServerTools(
  server: McpServer,
  options: {
    workspaceRoot: string
    packageIds: ExposedPackageId[]
    packageIdSchema: z.ZodType<ExposedPackageId>
  },
) {
  const { workspaceRoot, packageIds, packageIdSchema } = options

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
}
