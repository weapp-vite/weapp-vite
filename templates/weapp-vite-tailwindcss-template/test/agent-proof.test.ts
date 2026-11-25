import { expect, test } from '@mpcore/vitest'

test('agent proof counter increments', async ({ mpcore }) => {
  const result = await mpcore.renderPage('/pages/agent-proof/index')
  expect(result.screen.getByTestId('count')).toHaveTextContent('0')
  await result.user.tap(result.screen.getByTestId('increment'))
  expect(result.screen.getByTestId('count')).toHaveTextContent('1')
})
