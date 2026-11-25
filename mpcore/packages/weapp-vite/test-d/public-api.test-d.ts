/// <reference types="node" />

import type { launchAutomator } from 'weapp-vite/e2e'
import type { MiniProgramTestProject } from 'weapp-vite/test'
import {
  buildWeappViteTestArtifact,
  createTestProject,
  createWeappViteTestProject,
  mpcoreMatchers,
  watchWeappViteTestArtifact,
} from '@mpcore/weapp-vite'
import {
  launchAutomator as namespacedLaunchAutomator,
} from '@mpcore/weapp-vite/e2e'
import {
  buildTestArtifact,
  clearWeappViteTestArtifactCache,
  createTestProject as createNamespacedTestProject,
  createWeappViteTestProject as createNamespacedWeappViteTestProject,
  isTestArtifactCurrent,
  buildWeappViteTestArtifact as namespacedBuildWeappViteTestArtifact,
  watchWeappViteTestArtifact as namespacedWatchWeappViteTestArtifact,
  watchTestArtifact,
} from '@mpcore/weapp-vite/test'
import { expectType } from 'tsd'

expectType<Promise<MiniProgramTestProject>>(createWeappViteTestProject({ cwd: '/project' }))
expectType<MiniProgramTestProject>(createTestProject({ artifact: { projectPath: '/project' } }))
expectType<typeof mpcoreMatchers>(mpcoreMatchers)
expectType<MiniProgramTestProject>(createNamespacedTestProject({ artifact: { projectPath: '/project' } }))
expectType<Promise<MiniProgramTestProject>>(createNamespacedWeappViteTestProject({ cwd: '/project' }))
expectType<typeof launchAutomator>(namespacedLaunchAutomator)
expectType<Promise<string>>(buildTestArtifact({ cwd: '/project' }).then(artifact => artifact.appConfigPath))
expectType<Promise<boolean>>(buildTestArtifact({ cwd: '/project' }).then(isTestArtifactCurrent))
expectType<Promise<string>>(watchTestArtifact({ cwd: '/project' }).then(watcher => watcher.artifact.appConfigPath))
expectType<Promise<string>>(namespacedBuildWeappViteTestArtifact({ cwd: '/project' }).then(artifact => artifact.appConfigPath))
expectType<void>(clearWeappViteTestArtifactCache())
expectType<Promise<string>>(namespacedWatchWeappViteTestArtifact({}).then(watcher => watcher.artifact.appConfigPath))
expectType<Promise<string>>(buildWeappViteTestArtifact({ cwd: '/project' }).then(artifact => artifact.appConfigPath))
expectType<Promise<void>>(watchWeappViteTestArtifact({
  onRebuilt(artifact) {
    expectType<string>(artifact.miniprogramRootPath)
  },
}).then(watcher => watcher.close()))
