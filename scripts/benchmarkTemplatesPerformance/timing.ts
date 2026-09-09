import type { TemplatesHmrReport } from '../templates-performance-integrity'

/** 比较报告保留每一侧的计时来源，避免把输出观察时间称为编译器 profile。 */
export function summarizeHmrTimingSources(report: TemplatesHmrReport) {
  const samples = report.templates.flatMap(template => template.scenarios.flatMap(scenario => scenario.samples))
  return {
    compilerProfile: samples.filter(sample => sample.timingSource === 'compiler-profile').length,
    outputObservation: samples.filter(sample => sample.timingSource === 'output-observation').length,
    unspecified: samples.filter(sample => sample.timingSource !== 'compiler-profile' && sample.timingSource !== 'output-observation').length,
  }
}

export function renderHmrTimingSources(baseline: TemplatesHmrReport, optimized: TemplatesHmrReport) {
  return [
    '- HMR total 采用样本记录的计时值：有 compiler-profile 时使用编译器总时长，否则使用 output-observation；缺失的 core 分段显示为不可用。',
    ...([['baseline', baseline], ['optimized', optimized]] as const).map(([side, report]) => {
      const sources = summarizeHmrTimingSources(report)
      return `- ${side} 计时样本来源：compiler-profile ${sources.compilerProfile}，output-observation ${sources.outputObservation}，未声明 ${sources.unspecified}。`
    }),
  ]
}
