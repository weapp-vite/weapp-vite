import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ExposedPackageId } from '../constants'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DEFAULT_MAX_FILE_CHARS } from '../constants'
import { resolveExposedPackages } from '../exposedPackages'
import { readFileContent } from '../fileOps'
import { normalizeErrorMessage } from '../utils'
import { readTextFile, resolvePackageRoot, toDocsUri } from './shared'

export async function registerServerResources(
  server: McpServer,
  options: {
    workspaceRoot: string
    packageIds: ExposedPackageId[]
  },
) {
  const { workspaceRoot, packageIds } = options

  server.registerResource('workspace-catalog', 'weapp-vite://workspace/catalog', {
    title: 'Workspace Catalog',
    description: 'weapp-vite / wevu 包目录、版本和脚本列表',
    mimeType: 'application/json',
  }, async () => {
    const catalog = await resolveExposedPackages(workspaceRoot)
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
}
