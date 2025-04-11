import { resolvedComponentName } from './shared'

describe('resolvedComponentName', () => {
  it('should return the directory name for an index file', () => {
    const { componentName, base } = resolvedComponentName('components/HelloWorld/index')
    expect(componentName).toBe('HelloWorld')
    expect(base).toBe('index')
  })

  it('should return the base file name if it is not an index file', () => {
    const { componentName, base } = resolvedComponentName('components/HelloWorld/HelloWorld')
    expect(componentName).toBe('HelloWorld')
    expect(base).toBe('HelloWorld')
  })

  it('should return undefined if the entry is the root directory with index file', () => {
    const { componentName, base } = resolvedComponentName('index')
    expect(componentName).toBeUndefined()
    expect(base).toBe('index')
  })

  it('should return the base name of a file if there is no index in the path', () => {
    const { componentName, base } = resolvedComponentName('components/Footer/Footer')
    expect(componentName).toBe('Footer')
    expect(base).toBe('Footer')
  })

  it('should c', () => {
    const { componentName, base } = resolvedComponentName('components/Footer/index')
    expect(componentName).toBe('Footer')
    expect(base).toBe('index')
  })

  it('should return undefined if there is no file name and the path is just a directory', () => {
    const { componentName, base } = resolvedComponentName('components/hello-world/hello-world')
    expect(componentName).toBe('hello-world')
    expect(base).toBe('hello-world')
  })

  it('should 1', () => {
    const { componentName, base } = resolvedComponentName('components/hello-world/xxx')
    expect(componentName).toBe('xxx')
    expect(base).toBe('xxx')
  })
})
