import { expectType } from 'tsd'
import {
  buildTestArtifact,
  isTestArtifactCurrent,
  watchTestArtifact,
} from 'weapp-vite/test'

expectType<Promise<string>>(buildTestArtifact({ cwd: '/project' }).then(result => result.appConfigPath))
expectType<Promise<void>>(watchTestArtifact({ cwd: '/project' }).then(watcher => watcher.close()))
expectType<Promise<boolean>>(buildTestArtifact().then(isTestArtifactCurrent))
