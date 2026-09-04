import type {
  CreateTestProjectOptions,
  MiniProgramEmissionSource,
  MiniProgramNode,
  MiniProgramTestProject,
} from '@mpcore/test'
import { fileURLToPath } from 'node:url'
import { createTestProject, mpcoreMatchers } from '@mpcore/test'
import { expect, onTestFinished, test } from 'vitest'

export interface MpcoreVitestFixture {
  mpcore: MiniProgramTestProject
}

export interface MpcoreVitestPlugin {
  config: (config: { test?: { setupFiles?: string | string[] } }) => {
    test: { setupFiles: string[] }
  }
  name: string
}

function toList(value: string | string[] | undefined) {
  if (!value) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

export function mpcoreTest(): MpcoreVitestPlugin {
  const setupFile = fileURLToPath(new URL('./setup.mjs', import.meta.url))
  return {
    name: 'mpcore:vitest',
    config(config) {
      return {
        test: {
          setupFiles: [...toList(config.test?.setupFiles), setupFile],
        },
      }
    },
  }
}

export function createMpcoreTest(options: CreateTestProjectOptions) {
  return test.extend<MpcoreVitestFixture>({
    // eslint-disable-next-line no-empty-pattern -- Vitest 要求 fixture 的首个参数使用对象解构语法。
    mpcore: async ({}, use) => {
      const project = createTestProject(options)
      try {
        await use(project)
      }
      finally {
        await project.close()
      }
    },
  })
}

export function createVitestProject(options: CreateTestProjectOptions) {
  const project = createTestProject(options)
  onTestFinished(async () => {
    await project.close()
  })
  return project
}

export function registerMpcoreMatchers() {
  expect.extend(mpcoreMatchers)
}

declare module 'vitest' {
  interface Matchers<R, T> {
    toBeInTheMiniProgram: T extends MiniProgramNode ? () => R : never
    toHaveAttribute: T extends MiniProgramNode ? (name: string, value?: string) => R : never
    toHaveDataset: T extends MiniProgramNode ? (dataset: Record<string, unknown>) => R : never
    toHaveEmitted: T extends MiniProgramEmissionSource ? (eventName: string, detail?: unknown) => R : never
    toHaveTextContent: T extends MiniProgramNode ? (value: string | RegExp) => R : never
  }
}

export * from '@mpcore/test'
