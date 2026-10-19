import path from 'node:path'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createFixtureSessionOwner } from '../utils/fixtureSession'
import { createTemplateWevuTdesignRegressionLaunchOptions } from './template-wevu-tdesign-regression.shared'

const projectRoot = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
let aggregateOwnsSession = false
const owner = createFixtureSessionOwner({
  build: () => runWeappViteBuildWithLogCapture({
    cliPath: path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js'),
    projectRoot,
    cwd: projectRoot,
    platform: 'weapp',
    label: 'ide:template-wevu-tdesign-regression',
  }),
  launch: () => launchAutomator(createTemplateWevuTdesignRegressionLaunchOptions(projectRoot)),
  close: session => session.close(),
  deferClose: () => aggregateOwnsSession,
})

/** 聚合入口显式持有会话，子 suite 的 afterAll 只归还借用。 */
export function declareTdesignRegressionAggregate() {
  aggregateOwnsSession = true
}

export const getTdesignRegressionSession = owner.get
export const closeTdesignRegressionSession = owner.close
