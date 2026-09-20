import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { sanitizeAcceptanceText, sanitizeAcceptanceValue } from '../scripts/domAcceptanceReport/helpers'

interface DiagnosticFile {
  label: string
  path: string
  marker?: string
}

async function readDiagnosticFile(file: DiagnosticFile) {
  try {
    const content = await readFile(file.path)
    return {
      label: file.label,
      path: file.path,
      exists: true,
      bytes: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
      containsMarker: file.marker === undefined ? undefined : content.toString('utf8').includes(file.marker),
    }
  }
  catch (error) {
    return {
      label: file.label,
      path: file.path,
      exists: (error as NodeJS.ErrnoException).code === 'ENOENT' ? false : null,
      readError: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function collectHmrFailureDiagnostics(options: {
  files: DiagnosticFile[]
  profilePath: string
  devOutput: string
}) {
  let profile: unknown
  try {
    const lines = (await readFile(options.profilePath, 'utf8')).trim().split(/\r?\n/).slice(-24)
    profile = lines.filter(Boolean).map((line) => {
      try {
        const sample = JSON.parse(line) as Record<string, unknown>
        const samplePaths = [sample.file, sample.relativeFile, sample.sourceRootFile]
          .filter((value): value is string => typeof value === 'string')
          .map(value => value.replaceAll('\\', '/'))
        return {
          sample,
          matchingFiles: options.files.filter(file => samplePaths.some(value =>
            file.path.replaceAll('\\', '/') === value
            || file.path.replaceAll('\\', '/').endsWith(`/${value}`),
          )).map(file => file.label),
        }
      }
      catch (error) {
        return { raw: line, parseError: error instanceof Error ? error.message : String(error) }
      }
    })
  }
  catch (error) {
    profile = { readError: error instanceof Error ? error.message : String(error) }
  }
  return sanitizeAcceptanceValue({
    capturedAt: new Date().toISOString(),
    files: await Promise.all(options.files.map(readDiagnosticFile)),
    profile: { path: options.profilePath, recent: profile },
    recentDevOutput: options.devOutput.slice(-16_000),
  })
}

export async function enrichHmrFailure(error: unknown, options: Parameters<typeof collectHmrFailureDiagnostics>[0]) {
  const diagnostics = await collectHmrFailureDiagnostics(options)
  return new Error([
    sanitizeAcceptanceText(error instanceof Error ? error.message : String(error)),
    'HMR failure diagnostics (captured before source restoration):',
    JSON.stringify(diagnostics, null, 2),
  ].join('\n'))
}
