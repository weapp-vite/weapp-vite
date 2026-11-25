import type {
  CreateTestProjectOptions,
  MiniProgramEmissionSource,
  MiniProgramNode,
  MiniProgramTestProject,
} from '@mpcore/test'
import { createTestProject, mpcoreMatchers } from '@mpcore/test'
import { inject, onTestFinished, expect as vitestExpect, test as vitestTest } from 'vitest'
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
  return vitestTest.extend<MpcoreVitestFixture>({
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

function createLazyMpcoreTest() {
  let resolved: ReturnType<typeof createMpcoreTest> | undefined
  const resolve = () => resolved ??= createMpcoreTest()
  return new Proxy(vitestTest, {
    apply(_target, thisArg, argumentsList) {
      return Reflect.apply(resolve(), thisArg, argumentsList)
    },
    get(_target, property, receiver) {
      const test = resolve()
      const value = Reflect.get(test, property, receiver)
      if (typeof value === 'function') {
        return (...argumentsList: unknown[]) => Reflect.apply(value, test, argumentsList)
      }
      return value
    },
  }) as ReturnType<typeof createMpcoreTest>
}

/** 默认的 Vitest 入口，首次使用时提供隔离的 mpcore fixture。 */
const test = createLazyMpcoreTest()
const it = test

export function createVitestProject(options?: MpcoreTestProjectOptions) {
  const project = createTestProject(projectOptions(options))
  onTestFinished(async () => {
    await project.close()
  })
  return project
}

export function registerMpcoreMatchers() {
  vitestExpect.extend(mpcoreMatchers)
}

export { vitestExpect as expect, it, test }

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
