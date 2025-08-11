import type { Plugin } from 'rolldown-vite'
import { createCompilerContext } from '#src/createContext'
import { defu } from 'defu'

export interface UserDefinedOptions {
  stage: {
    build?: boolean
    output?: boolean
  }
  cwd?: string
}

export function customLoadEntryPlugin(options?: UserDefinedOptions): Plugin[] {
  createCompilerContext({
    cwd: options?.cwd,
  })
  const plugins: Plugin[] = []
  const { stage } = defu<UserDefinedOptions, UserDefinedOptions[]>(options, {
    stage: {
      build: true,
      output: true,
    },
  })
  if (stage.build) {
    plugins.push({
      name: 'weapp-vite:custom-build',

    })
  }
  if (stage.output) {
    plugins.push({
      name: 'weapp-vite:custom-output',

    })
  }

  return plugins
}
