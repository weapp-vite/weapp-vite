import type { MiniProgramTestProject } from '@mpcore/test'
import {
  buildWeappViteTestArtifact,
  createWeappViteTestProject,
  watchWeappViteTestArtifact,
} from '@mpcore/weapp-vite'
import { expectType } from 'tsd'

expectType<Promise<MiniProgramTestProject>>(createWeappViteTestProject({ cwd: '/project' }))
expectType<Promise<string>>(buildWeappViteTestArtifact({ cwd: '/project' }).then(artifact => artifact.appConfigPath))
expectType<Promise<void>>(watchWeappViteTestArtifact({
  onRebuilt(artifact) {
    expectType<string>(artifact.miniprogramRootPath)
  },
}).then(watcher => watcher.close()))
