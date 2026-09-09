import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export const EMIT_ROUTE = '/pages/vue-compat/script-setup/index'

const payload = { payloadType: 'object', kind: 'payload', marker: 'payload-detail', metaSource: 'CompatEmitMatrix', title: 'matrix-payload' }
const native = { payloadType: 'object', nativeType: 'tap', detailType: 'undefined', timeStampType: 'number' }
const tuple = { payloadType: 'array', first: 'alpha', second: 2, thirdOk: true, tupleLength: 3 }
const options = { payloadType: 'object', kind: 'options', marker: 'options-detail', metaSource: 'CompatEmitMatrix', title: 'matrix-options' }

export const EMIT_CASES = [
  { id: 'emit-direct-payload', expected: { label: 'payload-direct', ...payload } },
  { id: 'emit-explicit-payload', expected: { label: 'payload-explicit-$event', ...payload } },
  { id: 'emit-inline-payload', expected: { label: 'payload-inline-title', payloadType: 'string', value: 'matrix-payload' } },
  { id: 'emit-direct-native', expected: { label: 'native-direct', ...native } },
  { id: 'emit-explicit-native', expected: { label: 'native-explicit-$event', ...native } },
  { id: 'emit-direct-tuple', expected: { label: 'tuple-direct', ...tuple } },
  { id: 'emit-explicit-tuple', expected: { label: 'tuple-explicit-$event', ...tuple } },
  { id: 'emit-direct-empty', expected: { label: 'empty-direct', payloadType: 'undefined' } },
  { id: 'emit-explicit-empty', expected: { label: 'empty-explicit-$event', payloadType: 'undefined' } },
  { id: 'emit-direct-options', expected: { label: 'options-direct', ...options } },
  { id: 'emit-explicit-options', expected: { label: 'options-explicit-$event', ...options } },
]

const fields: Record<string, string> = {
  label: 'label',
  payloadType: 'type',
  value: 'value',
  kind: 'kind',
  marker: 'marker',
  metaSource: 'source',
  title: 'title',
  nativeType: 'native',
  detailType: 'detail',
  timeStampType: 'timestamp',
  first: 'first',
  second: 'second',
  thirdOk: 'third',
  tupleLength: 'length',
}

export const EMIT_CHECKPOINTS: DomCheckpoint[] = [
  ...['initial', 'reset'].map(id => ({
    id,
    route: EMIT_ROUTE,
    action: id === 'initial' ? 'launch emit matrix' : 'tap reset',
    nodes: [
      { selector: '#emit-matrix-reset', text: '清空矩阵记录' },
      { selector: '#emit-record-count', text: '0' },
      { selector: '.emit-record', count: 0 },
    ],
  })),
  ...EMIT_CASES.map((testCase, index) => ({
    id: testCase.id,
    route: EMIT_ROUTE,
    action: `tap child component #${testCase.id}`,
    nodes: [
      { selector: '#emit-record-count', text: String(index + 1) },
      { selector: '.emit-record', count: index + 1 },
      ...Object.entries(testCase.expected).map(([key, value]) => ({
        selector: `#emit-record-0 .emit-${fields[key]}`,
        text: String(value),
      })),
    ],
  })),
]
