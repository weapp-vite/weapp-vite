import type { DoctorDiagnostic, DoctorReport } from './types'
import { createHash } from 'node:crypto'

export function addDiagnostic(report: DoctorReport, diagnostic: Omit<DoctorDiagnostic, 'fingerprint'>) {
  const fingerprint = createHash('sha256').update(JSON.stringify([
    diagnostic.ruleId,
    diagnostic.target,
    diagnostic.layer,
    diagnostic.location,
    diagnostic.evidence,
  ])).digest('hex')
  if (!report.diagnostics.some(item => item.fingerprint === fingerprint)) {
    report.diagnostics.push({ ...diagnostic, fingerprint })
  }
}

export function finishReport(report: DoctorReport): DoctorReport {
  report.diagnostics.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint))
  report.exitCode = report.coverage.some(item => item.status === 'incomplete')
    ? 2
    : report.diagnostics.some(item => item.severity === 'error') ? 1 : 0
  return report
}

export function formatDoctorReport(report: DoctorReport, format: 'terminal' | 'json' | 'sarif' = 'terminal'): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2)
  }
  if (format === 'sarif') {
    return JSON.stringify({
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'weapp-vite doctor', rules: [...new Set(report.diagnostics.map(d => d.ruleId))].map(id => ({ id })) } },
        invocations: [{ executionSuccessful: report.exitCode !== 2 }],
        properties: { coverage: report.coverage, exitCode: report.exitCode, artifacts: report.artifacts, runtime: report.runtime },
        results: report.diagnostics.map(d => ({
          ruleId: d.ruleId,
          level: d.severity,
          message: { text: d.message },
          partialFingerprints: { 'doctor/v1': d.fingerprint },
          locations: d.location
            ? [{
                physicalLocation: {
                  artifactLocation: { uri: d.location.file.split('/').map(encodeURIComponent).join('/') },
                  region: d.location.line ? { startLine: d.location.line, startColumn: d.location.column ?? 1 } : undefined,
                },
              }]
            : [],
          properties: { target: d.target, layer: d.layer, evidence: d.evidence, responsibility: d.responsibility, suggestion: d.suggestion },
        })),
      }],
    }, null, 2)
  }
  return [
    `Doctor: exit ${report.exitCode}`,
    ...report.coverage.map(c => `[${c.target}] ${c.layer}/${c.check}: ${c.status}${c.reason ? ` — ${c.reason}` : ''}`),
    ...Object.entries(report.runtime).flatMap(([target, evidence]) => evidence.bundle
      ? [
          `[${target}] framework=${evidence.bundle.frameworkVersion} node=${evidence.bundle.nodeVersion} IDE=${evidence.bundle.versions.ide ?? 'unknown'} SDK=${evidence.bundle.versions.sdk ?? 'unknown'}`,
          `最后成功阶段：${evidence.bundle.lastSuccessfulStage ?? 'unknown'}`,
          `复现：${evidence.bundle.reproduction}`,
        ]
      : []),
    ...report.diagnostics.map(d => `[${d.severity}] ${d.target} ${d.ruleId} ${d.location?.file ?? ''} ${d.message}\n  ${d.suggestion}`),
  ].join('\n')
}
