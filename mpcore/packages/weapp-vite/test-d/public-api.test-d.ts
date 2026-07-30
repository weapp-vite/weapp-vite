import type { MiniProgramTestProject } from '@mpcore/test'
import {
  buildWeappViteTestArtifact,
  createWeappViteTestProject,
} from '@mpcore/weapp-vite'
import { expectType } from 'tsd'

expectType<Promise<MiniProgramTestProject>>(createWeappViteTestProject({ cwd: '/project' }))
expectType<Promise<string>>(buildWeappViteTestArtifact({ cwd: '/project' }).then(artifact => artifact.appConfigPath))
