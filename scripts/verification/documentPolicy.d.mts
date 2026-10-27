export function isRootPolicyDocument(file: unknown): boolean
export function rootDocumentationChanges(files: unknown): string[] | null
export const DOCUMENT_CONTRACTS: { agents: 'agents:check', skills: 'skills:check' }
export type DocumentContract = keyof typeof DOCUMENT_CONTRACTS
export function requiredDocumentContracts(files: string[]): DocumentContract[]
