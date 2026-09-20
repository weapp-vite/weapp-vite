export interface DatasetNodeLike {
  attribs?: Record<string, string>
  dataset?: Record<string, unknown>
}

const DATASET_NAME_RE = /-([a-z])/g

export function isDatasetAttribute(attributeName: string) {
  return attributeName.startsWith('data-') && !attributeName.startsWith('data-sim-')
}

export function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

export function collectNodeDataset(node: DatasetNodeLike) {
  if (node.dataset) {
    return { ...node.dataset }
  }

  const dataset: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (isDatasetAttribute(key)) {
      dataset[toDatasetKey(key)] = value
    }
  }
  return dataset
}
