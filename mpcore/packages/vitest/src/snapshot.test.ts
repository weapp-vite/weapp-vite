import type { HeadlessTestingPageHandle, HeadlessTestingPageSnapshot } from '@mpcore/simulator'
import { MiniProgramScreen } from '@mpcore/test'
import { expect, it } from 'vitest'
import './setup'

it('registers the stable tree serializer through the default setup', () => {
  const snapshot: HeadlessTestingPageSnapshot = {
    data: { generatedState: '__helper_a83cd' },
    path: '/fixture',
    query: {},
    root: {
      attrs: { 'id': 'save', 'data-sim-node': 'internal-node', 'bindtap': '__helper_a83cd' },
      children: [{ attrs: {}, children: [], text: '保存', type: 'text' }],
      nodeId: 'internal-node',
      tag: 'button',
      text: '保存',
      type: 'element',
    },
    wxml: '<button data-sim-node="internal-node" />',
  }
  const page = {
    assertActive() {},
    async snapshot() { return snapshot },
  } as unknown as HeadlessTestingPageHandle
  const screen = new MiniProgramScreen(page, snapshot)

  expect(screen).toMatchInlineSnapshot(`
    {
      "attributes": {
        "bindtap": "[handler]",
        "id": "save"
      },
      "children": [
        {
          "text": "保存"
        }
      ],
      "tag": "button"
    }
  `)
})
