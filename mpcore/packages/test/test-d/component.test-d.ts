import type { InlineComponentStub, MiniProgramComponentRenderResult, MiniProgramEventListener, MiniProgramRenderResult } from '@mpcore/test'
import { createTestProject } from '@mpcore/test'
import { expectError, expectType } from 'tsd'

const project = createTestProject({ artifact: { projectPath: './fixture-project' } })
const listener: MiniProgramEventListener = (detail, event) => {
  expectType<unknown>(detail)
  expectType<Record<string, any>>(event)
}
const stub: InlineComponentStub = { template: '<text>{{label}}</text>', properties: { label: '' }, data: { count: 1 } }
expectType<Promise<MiniProgramComponentRenderResult>>(project.renderComponent('components/subject/index', {
  events: ['change'],
  on: { change: listener },
  usingComponents: { leaf: stub, other: 'components/other/index' },
}))
declare const result: MiniProgramComponentRenderResult
expectType<Promise<void>>(result.setProperties({ label: 'new' }))
expectType<Promise<void>>(result.setData({ count: 2 }))
expectType<Promise<void>>(result.unmount())
expectType<() => void>(result.on('change'))
expectType<() => void>(result.on('change', listener))
expectType<void>(result.off('change', listener))
expectType<void>(result.off('change'))
expectType<unknown[]>(result.emitted('change'))
expectType<Promise<MiniProgramRenderResult>>(project.renderPage('/pages/index/index'))
expectError(project.renderComponent('components/subject/index', { usingComponents: { leaf: true } }))
expectError(project.renderComponent('components/subject/index', { usingComponents: { leaf: { methods: {} } } }))
