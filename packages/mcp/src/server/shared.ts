import type { ExposedPackageId } from '../constants'
import fs from 'node:fs/promises'
import { runCommand } from '../commandOps'
import { DEFAULT_TIMEOUT_MS } from '../constants'
import { resolveExposedPackage } from '../exposedPackages'
import { assertInsideRoot, resolveSubPath } from '../workspace'

export async function resolvePackageRoot(workspaceRoot: string, packageId: ExposedPackageId) {
  const resolved = await resolveExposedPackage(workspaceRoot, packageId)
  if (!resolved.sourceRoot) {
    throw new Error(`当前工作区中的 ${packageId} 不包含源码目录，请改为优先读取本地随包文档。`)
  }
  return assertInsideRoot(workspaceRoot, resolved.sourceRoot)
}

export function toDocsUri(packageId: ExposedPackageId, fileName: string) {
  return `weapp-vite://docs/${packageId}/${fileName}`
}

export async function readTextFile(filePath: string) {
  return fs.readFile(filePath, 'utf8')
}

export async function runWeappViteCliTool(
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
