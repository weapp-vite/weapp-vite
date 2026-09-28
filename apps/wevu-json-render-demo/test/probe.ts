import { createJsonRenderer } from '@wevu/json-render'
import { catalog } from '../src/catalog'
import { afterSalesSpec } from '../src/fixtures/afterSales'
import { initialState } from '../src/state'

export function probe() {
  const renderer = createJsonRenderer({ catalog, spec: afterSalesSpec, initialState: initialState(), actions: { submit() {}, inspect() {} } })
  renderer.createStream().push('{"op":"replace","path":"/elements/form/props/title","value":"兼容检查"}\n')
  const title = renderer.tree.value?.children[1]?.props.title
  renderer.dispose()
  return title
}
