function state(sequence: number, phase: string, a: string, b: unknown) {
  return { sequence, phase, dataA: a, dataB: b, propertyA: a, propertyB: b }
}

function changes(sequence: number, a: string, b: unknown, previousA: string, previousB: unknown) {
  return [
    state(sequence, 'data:a,b', a, b),
    { ...state(sequence, 'property:a', a, b), next: a, previous: previousA },
    { ...state(sequence, 'property:b', a, b), next: b, previous: previousB },
  ]
}

// 来源为真实 IDE 的页面文本与 data 双重验收；属性批次不随 WXML 属性顺序变化。
export function initialPropertiesExpectedTrace(updated = false) {
  const incoming = ['item', { label: 'alpha' }, 'index', 0]
  const initial = [
    ...[0, 1].flatMap(sequence => [
      state(sequence, 'created', 'default-a', null),
      ...changes(sequence, 'incoming-a', incoming, 'default-a', null),
    ]),
    ...[0, 1].map(sequence => state(sequence, 'attached', 'incoming-a', incoming)),
  ]
  return updated
    ? [...initial, ...[0, 1].flatMap(sequence => changes(sequence, 'updated-a', ['item', { label: 'beta' }, 'index', 1], 'incoming-a', incoming))]
    : initial
}
