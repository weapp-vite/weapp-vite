import type { ProcessRow } from './index'
import { insideInstallation, validProcessImage } from './index'

/** 准备阶段出现过所选映像或其后代即保留关闭门禁，不因随后退出消除证据。 */
export function observedPreparationMembers(rows: ProcessRow[], paths: Map<number, string | null>, images: Map<number, string[]>, installationRoot: string) {
  const members = new Set(rows.filter((row) => {
    const kernelImage = paths.get(row.pid)
    return (validProcessImage(kernelImage) && insideInstallation(installationRoot, kernelImage))
      || images.get(row.pid)?.some(image => insideInstallation(installationRoot, image))
  }).map(row => row.pid))
  let added = true
  while (added) {
    added = false
    for (const row of rows) {
      if (!members.has(row.pid) && members.has(row.parentPid)) {
        members.add(row.pid)
        added = true
      }
    }
  }
  return members
}
