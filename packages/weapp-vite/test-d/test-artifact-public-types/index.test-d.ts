/// <reference types="node" />

import type { MiniProgramTestProject } from 'weapp-vite/test'
import { expectType } from 'tsd'
import {
  buildTestArtifact,
  createTestProject,
  isTestArtifactCurrent,
  watchTestArtifact,
} from 'weapp-vite/test'

expectType<MiniProgramTestProject>(createTestProject({ artifact: { projectPath: '/project' } }))
expectType<Promise<string>>(buildTestArtifact({ cwd: '/project' }).then(result => result.appConfigPath))
expectType<Promise<void>>(watchTestArtifact({ cwd: '/project' }).then(watcher => watcher.close()))
expectType<Promise<boolean>>(buildTestArtifact().then(isTestArtifactCurrent))
