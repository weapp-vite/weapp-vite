import type {
  HeadlessSession,
  HeadlessTestingLaunchOptions,
  HeadlessTestingSessionHandle,
} from '..'
import { expectType } from 'tsd'
import { launch } from '..'

const synchronousOptions: HeadlessTestingLaunchOptions = {
  onSessionCreated(session) {
    expectType<HeadlessTestingSessionHandle>(session)
  },
  configureSession(session) {
    expectType<HeadlessSession>(session)
  },
  projectPath: 'fixture-project',
}
expectType<Promise<HeadlessTestingSessionHandle>>(launch(synchronousOptions))

const asynchronousOptions: HeadlessTestingLaunchOptions = {
  async configureSession(session) {
    expectType<HeadlessSession>(session)
    await Promise.resolve()
  },
  projectPath: 'fixture-project',
}
expectType<Promise<HeadlessTestingSessionHandle>>(launch(asynchronousOptions))
