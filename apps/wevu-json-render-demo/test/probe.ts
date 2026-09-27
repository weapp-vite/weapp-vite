import { afterSalesSpec } from '../src/fixtures/afterSales'
import { initialState, projectSpec } from '../src/runtime/projection'
import { validateSpec } from '../src/runtime/schema'
import { createDemoStream } from '../src/runtime/stream'

export function probe() {
  const spec = validateSpec(afterSalesSpec).spec
  const stream = createDemoStream(spec)
  const updated = stream.push('{"op":"replace","path":"/elements/form/props/title","value":"兼容检查"}\n')!
  return projectSpec(updated, initialState())?.children[1]?.props.title
}
