/** 采集完成不等于性能通过；旧报告没有门禁证据时保持未验收。 */
export function performanceVerdict(data) {
  const gates = data.platforms.map(item => item.gate)
  if (gates.some(gate => gate?.status === 'regression') || data.autoImport?.confirmedFailures?.length) {
    return '未通过（确认回退或启用成本超预算）'
  }
  if (gates.some(gate => gate && gate.status !== 'passed')) {
    return '未完成验收（不稳定、缺样本或不可比较）'
  }
  if (data.errors.length || gates.length !== 3 || gates.some(gate => !gate)) {
    return '未完成验收（缺少三平台成对采样门禁证据）'
  }
  return '通过三平台成对采样门禁；功能启用成本另列'
}

/** 只读取真实采样层级，首次样本不冒充重复构建。 */
export function renderTemplateRows(platforms, pair) {
  const lines = []
  for (const item of [...platforms].sort((a, b) => a.platform.localeCompare(b.platform))) {
    const a = item.baseline.build
    const b = item.optimized.build
    const hmr = item.hmr.all
    const first = side => mean(side.samples?.filter(sample => sample.iteration === 1 && sample.status === 0).map(sample => sample.totalMs))
    const warm = side => side.warm?.count > 0 ? side.warm.totalAverageMs : undefined
    lines.push(`| ${item.platform} | ${pair(first(a), first(b), 'ms')} | ${pair(warm(a), warm(b), 'ms')} | ${pair(item.build.all.cliAverageBaselineMs, item.build.all.cliAverageOptimizedMs, 'ms')} | ${pair(item.build.all.rssPeakAverageBaselineBytes, item.build.all.rssPeakAverageOptimizedBytes, 'bytes')} | ${pair(hmr.coreAverageBaselineMs, hmr.coreAverageOptimizedMs, 'ms')} | ${pair(hmr.wallAverageBaselineMs, hmr.wallAverageOptimizedMs, 'ms')} | ${pair(hmr.heapUsedAverageBaselineBytes, hmr.heapUsedAverageOptimizedBytes, 'bytes')} | ${pair(hmr.rssAverageBaselineBytes, hmr.rssAverageOptimizedBytes, 'bytes')} |`)
  }
  lines.push('', '<details>', '<summary>逐模板／HMR 场景、样本数与计时来源</summary>', '')
  for (const item of platforms) {
    lines.push(`- ${item.platform}：build ${item.buildIterations ?? '未知'} 次，HMR ${item.hmrIterations ?? '未知'} 次；采样环境 ${safe(item.environment ? JSON.stringify(item.environment) : '旧报告未记录')}。`, `  提交：${safe(item.baseline.commit)} → ${safe(item.optimized.commit)}；完整 SHA 以报告元数据为准。`, '', '| 场景 | 样本数（基线／当前） | 耗时变化 |', '| --- | ---: | ---: |')
    for (const row of item.build.rows ?? []) {
      lines.push(`| ${safe(row.id)} / build | ${row.baseline.count} / ${row.optimized.count} | ${row.comparable === false ? '不可比较' : pair(row.baseline.totalMedianMs, row.optimized.totalMedianMs, 'ms')} |`)
    }
    for (const row of item.hmr.rows ?? []) {
      lines.push(`| ${safe(row.key)} / HMR wall | ${row.baseline.wallSamples?.length ?? 0} / ${row.optimized.wallSamples?.length ?? 0} | ${row.comparable === false ? '不可比较' : pair(row.baseline.averageWallMs, row.optimized.averageWallMs, 'ms')} |`)
    }
    const sources = (side) => {
      const counts = {}
      for (const template of side.hmr.templates ?? []) {
        for (const scenario of template.scenarios ?? []) {
          for (const sample of scenario.samples ?? []) {
            const key = sample.timingSource ?? '未记录'
            counts[key] = (counts[key] ?? 0) + 1
          }
        }
      }
      return JSON.stringify(counts)
    }
    lines.push('', `计时来源（基线／当前）：${safe(sources(item.baseline))} / ${safe(sources(item.optimized))}。core 不可用时不会由 wall 替代；重复构建不可用表示没有有效重复样本。`, '')
  }
  lines.push('</details>')
  return lines
}

/** 逐场景列出成本增加，分别保留时间和字节单位。 */
export function collectRegressions(data) {
  const items = []
  const add = (area, metric, baseline, current, unit = 'ms') => {
    if (!Number.isFinite(baseline) || !Number.isFinite(current) || current <= baseline) {
      return
    }
    items.push({ area, metric, delta: current - baseline, percent: baseline === 0 ? undefined : (current - baseline) / baseline * 100, unit })
  }
  for (const item of data.platforms) {
    for (const row of item.build.rows ?? []) {
      if (row.comparable === false) {
        continue
      }
      add(item.platform, `${row.id} / build`, row.baseline.totalMedianMs, row.optimized.totalMedianMs)
      add(item.platform, `${row.id} / build RSS`, row.baseline.rssPeakAverageBytes, row.optimized.rssPeakAverageBytes, 'bytes')
    }
    for (const row of item.hmr.rows ?? []) {
      if (row.comparable === false) {
        continue
      }
      add(item.platform, `${row.key} / HMR wall`, row.baseline.averageWallMs, row.optimized.averageWallMs)
      add(item.platform, `${row.key} / HMR RSS`, row.baseline.rssAverageBytes, row.optimized.rssAverageBytes, 'bytes')
    }
  }
  for (const row of data.autoImport?.build?.results ?? []) {
    add('自动导入启用成本', `${row.usedCount} 组件 / build`, row.baseline?.mean, row.current?.mean)
  }
  for (const row of data.autoImport?.hmr?.results ?? []) {
    add('自动导入启用成本', `${row.usedCount} 组件 / HMR`, row.update?.baseline?.mean, row.update?.current?.mean)
  }
  return items.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
}

function mean(values) {
  return values?.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
}
function safe(value) {
  return String(value ?? '未记录').replaceAll('|', '\\|').replaceAll('`', '').replaceAll('\n', ' ')
}
