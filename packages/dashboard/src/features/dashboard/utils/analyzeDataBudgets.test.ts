import type { AnalyzeSubpackagesResult } from '../types'
import { describe, expect, it } from 'vitest'
import { createBudgetWarnings } from './analyzeDataBudgets'
import { createLargestFiles } from './analyzeDataPackages'
import { filterLargestFilesByTreemapState } from './treemapFilters'

function report(): AnalyzeSubpackagesResult {
  return {
    metadata: {
      generatedAt: '',
      history: { enabled: false, dir: '', limit: 0 },
      budgets: { totalBytes: 1000, mainBytes: 1000, subPackageBytes: 1000, independentBytes: 1000, runtimeBytes: 50, warningRatio: 0.85, source: 'config' },
    },
    packages: [{
      id: 'main',
      label: 'main',
      type: 'main',
      files: [
        { file: 'runtime.js', type: 'chunk', from: 'main', size: 80 },
        { file: 'image.png', type: 'asset', from: 'main', size: 30 },
      ],
    }],
    modules: [],
    subPackages: [],
  }
}

describe('shared Dashboard budget warnings', () => {
  it('preserves unavailable runtime attribution and incomplete file measurements as unknown', () => {
    const value = report()
    expect(createBudgetWarnings(value)).toEqual([
      expect.objectContaining({ scope: 'runtime', status: 'unknown', files: ['runtime.js'] }),
    ])
    delete value.packages[0]!.files[0]!.size
    expect(createBudgetWarnings(value).map(item => [item.id, item.status]).sort()).toEqual([
      ['__runtime__', 'unknown'],
      ['__total__', 'unknown'],
      ['main', 'unknown'],
    ])
  })

  it('locates runtime contributing files without treating runtime as a package id', () => {
    const value = report()
    const warning = createBudgetWarnings(value).find(item => item.scope === 'runtime')!
    const files = createLargestFiles(value, new Map())
    const filterState = {
      mode: 'all' as const,
      selectedPackageId: null,
      growthFileKeys: new Set<string>(),
      growthModuleIds: new Set<string>(),
      duplicateModuleIds: new Set<string>(),
    }
    expect(filterLargestFilesByTreemapState({ files, filterState, warning }).map(file => file.file)).toEqual(['runtime.js'])
    expect(filterLargestFilesByTreemapState({
      files,
      filterState: { ...filterState, mode: 'selected-package', selectedPackageId: 'other' },
      warning,
    })).toEqual([])
  })
})
