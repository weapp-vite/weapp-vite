import { fdir as Fdir } from 'fdir'

export async function scanFiles(root: string) {
  const api = new Fdir().withRelativePaths()

  return (await api.crawl(root).withPromise()).sort((a, b) => a.localeCompare(b))
}
