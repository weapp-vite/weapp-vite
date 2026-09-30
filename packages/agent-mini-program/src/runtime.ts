import type { ProjectConfig } from '@weapp-agent/core'
import path from 'node:path'
import process from 'node:process'
import { exists } from './project.js'

export async function builtinMcp(
  root: string,
): Promise<ProjectConfig['mcp'][number] | undefined> {
  const bin = path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js')
  if (!(await exists(bin))) {
    return undefined
  }
  return {
    name: 'weapp',
    transport: 'stdio',
    command: process.execPath,
    args: [bin, 'mcp', '--workspace-root', root],
  }
}
