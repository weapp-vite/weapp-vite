export interface ResolvedValue { name: string, from: string }

export type Resolver = (componentName: string) => ResolvedValue | void

export type CreateResolver<T = any> = (options?: T) => Resolver
