const trace: string[] = []

export function resetTrace() {
  trace.length = 0
}

export function readTrace(): string[] {
  return [...trace]
}

export function recordPageLoad() {
  trace.push('page:onLoad')
}

export function relationLabels(nodes: { data: { label?: string } }[]) {
  return nodes.map(node => node.data.label).join(',') || 'none'
}

export function recordRelation(label: string, event: string, nodes: { data: { label?: string } }[]) {
  trace.push(`${label}:${event}:${relationLabels(nodes)}`)
}
