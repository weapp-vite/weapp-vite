export interface WorkbenchFileNode {
  children?: WorkbenchFileNode[]
  depth: number
  name: string
  path: string
  type: 'directory' | 'file'
}
