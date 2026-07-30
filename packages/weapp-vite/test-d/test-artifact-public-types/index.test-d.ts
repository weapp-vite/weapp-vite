import { expectType } from 'tsd'
import {
  buildTestArtifact,
  watchTestArtifact,
} from 'weapp-vite/test'

expectType<Promise<string>>(buildTestArtifact({ cwd: '/project' }).then(result => result.appConfigPath))
expectType<Promise<void>>(watchTestArtifact({ cwd: '/project' }).then(watcher => watcher.close()))
