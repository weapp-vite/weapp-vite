export interface PageScrollInspection {
  empty: boolean
  hasSetDataCall: boolean
  syncApis: Set<string>
}

export interface OxcLoc {
  line: number
  column: number
}
