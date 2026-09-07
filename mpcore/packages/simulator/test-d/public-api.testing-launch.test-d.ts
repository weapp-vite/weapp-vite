import type {
  HeadlessSession,
  HeadlessTestingLaunchOptions,
  HeadlessTestingSessionHandle,
} from '..'
import { expectType } from 'tsd'
import { launch } from '..'

const synchronousOptions: HeadlessTestingLaunchOptions = {
  configureSession(session) {
    expectType<HeadlessSession>(session)
  },
  projectPath: '/tmp/project',
}
expectType<Promise<HeadlessTestingSessionHandle>>(launch(synchronousOptions))

const asynchronousOptions: HeadlessTestingLaunchOptions = {
  async configureSession(session) {
    expectType<HeadlessSession>(session)
    await Promise.resolve()
  },
  projectPath: '/tmp/project',
}
expectType<Promise<HeadlessTestingSessionHandle>>(launch(asynchronousOptions))
