import {
  artifactFromProject,
  createTestProject,
  createWxMock,
  wechat,
} from '@mpcore/test'
import { expectType } from 'tsd'

const project = createTestProject({
  artifact: artifactFromProject('/project'),
  host: createWxMock(),
  platform: wechat(),
})

expectType<Promise<void>>(project.close())
expectType<ReturnType<typeof project.renderPage>>(project.renderPage('/pages/index/index?from=test'))
expectType<ReturnType<typeof project.renderComponent>>(project.renderComponent('components/counter/index', {
  properties: { value: 1 },
  slots: { default: '<text>counter</text>' },
}))

declare const result: Awaited<ReturnType<typeof project.renderComponent>>
const nested = result.screen.within(result.screen.getByTestId('counter'))
expectType<Promise<void>>(result.user.tap(nested.getByRole('button')))
expectType<Promise<void>>(result.user.input(nested.getByRole('textbox'), 'edited'))
