import type {
  CreateTestProjectOptions,
  MiniProgramEmissionSource,
  MiniProgramNode,
  MiniProgramTestProject,
} from '@mpcore/test'
import { createTestProject, mpcoreMatchers } from '@mpcore/test'
import { expect, inject, onTestFinished, test } from 'vitest'
import { MPCORE_ARTIFACT_KEY } from './artifact'

export { mpcoreTest } from './config'
export type { MpcoreArtifactFactory, MpcoreArtifactWatchCallbacks, MpcoreArtifactWatcher, MpcoreVitestOptions, MpcoreVitestPlugin } from './config'

export interface MpcoreVitestFixture {
  mpcore: MiniProgramTestProject
}

export type MpcoreTestProjectOptions = Omit<CreateTestProjectOptions, 'artifact'> & Partial<Pick<CreateTestProjectOptions, 'artifact'>>

function projectOptions(options: MpcoreTestProjectOptions = {}): CreateTestProjectOptions {
  const artifact = options.artifact ?? inject(MPCORE_ARTIFACT_KEY)
  if (!artifact) {
    throw new Error('No mpcore artifact was provided. Configure mpcoreTest({ artifact }) from @mpcore/vitest/config or pass an explicit artifact.')
  }
  return { ...options, artifact }
}

export function createMpcoreTest(options?: MpcoreTestProjectOptions) {
  return test.extend<MpcoreVitestFixture>({
    // eslint-disable-next-line no-empty-pattern -- Vitest 要求 fixture 的首个参数使用对象解构语法。
    mpcore: async ({}, use) => {
      const project = createTestProject(projectOptions(options))
      try {
        await use(project)
      }
      finally {
        await project.close()
      }
    },
  })
}

export function createVitestProject(options?: MpcoreTestProjectOptions) {
  const project = createTestProject(projectOptions(options))
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
    toHaveDataset: T extends MiniProgramNode ? (dataset: Record<string, unknown>) => R : never
    toHaveEmitted: T extends MiniProgramEmissionSource ? (eventName: string, detail?: unknown) => R : never
  }

  // 同名 DOM matcher 由 browser 扩展 Assertion；在这里合并兼容签名，避免两个父接口冲突。
  // eslint-disable-next-line ts/no-unused-vars -- 声明合并必须保留 Vitest 的泛型参数名。
  interface Assertion<R, T> {
    toHaveAttribute: (name: string, value?: unknown) => R
    toHaveTextContent: (value?: string | number | RegExp, options?: { normalizeWhitespace: boolean }) => R
  }
}

export * from '@mpcore/test'
