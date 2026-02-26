export type DocumentBucket = 'docs' | 'blog' | 'page'

export type FrontmatterKind = 'standard' | 'bare' | 'none'

export interface MarkdownDocument {
  absolutePath: string
  relativePath: string
  routePath: string
  bucket: DocumentBucket
  raw: string
  body: string
  frontmatter: Record<string, unknown>
  frontmatterKind: FrontmatterKind
  headings: string[]
  firstParagraph: string
}

export type CoverageField = 'title' | 'description' | 'keywords' | 'date'

export interface CoverageSummary {
  total: number
  title: number
  description: number
  keywords: number
  date: number
}

export interface QualityIssue {
  path: string
  type:
    | 'missing-description'
    | 'short-description'
    | 'templated-description'
    | 'missing-keywords'
    | 'few-keywords'
    | 'non-normalized-keywords'
    | 'duplicate-keywords'
    | 'keyword-too-long'
    | 'description-keyword-noise'
  message: string
  detail?: string
}

export interface QualitySummary {
  checked: number
  issues: QualityIssue[]
}
