import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url))

function collectProjectDirs(baseDir: string) {
  const absoluteBase = join(workspaceRoot, baseDir)
  if (!existsSync(absoluteBase)) {
    return []
  }

  return readdirSync(absoluteBase, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(baseDir, entry.name))
    .filter(projectDir => existsSync(join(workspaceRoot, projectDir, 'vitest.config.ts')))
}

export default defineConfig(
  () => {
    const projects = [
      ...collectProjectDirs('packages'),
      ...collectProjectDirs('@weapp-core'),
      ...collectProjectDirs('apps'),
    ]

    return {
      test: {
        projects,
        coverage: {
          enabled: true,
          all: false,
          skipFull: true,
        },
        forceRerunTriggers: [
          // '**/package.json/**',
          '**/vitest.config.*/**',
          '**/vite.config.*/**',
        ],
      },
    }
  },
)
