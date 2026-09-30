import type {
  ProjectAdapter,
  ProjectInfo,
  Tool,
} from '@weapp-agent/core'
import { z } from 'zod'
import { detectProject, projectInstructions } from './project.js'

export * from './acceptance.js'
export * from './mcp.js'
export * from './project.js'
export * from './runtime.js'
export * from './scenario.js'
export * from './server.js'

export class WeappProjectAdapter implements ProjectAdapter {
  detect = detectProject
  instructions = projectInstructions
  async tools(project: ProjectInfo): Promise<Tool[]> {
    return [
      {
        name: 'project_info',
        description:
          'Inspect the current mini-program project structure, scripts and framework. Re-check after changing project configuration.',
        schema: z.strictObject({}),
        mutates: false,
        async execute() {
          return {
            text: JSON.stringify(await detectProject(project.root), null, 2),
          }
        },
      },
    ]
  }
}
export * from './verify.js'
