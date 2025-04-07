import { resolvedComponentName } from './shared'

describe('resolvedComponentName', () => {
  it('should return the directory name for an index file', () => {
    const { componentName, isIndex } = resolvedComponentName('components/HelloWorld/index')
    expect(componentName).toBe('HelloWorld')
    expect(isIndex).toBe(true)
  })

  it('should return the base file name if it is not an index file', () => {
    const { componentName, isIndex } = resolvedComponentName('components/HelloWorld/HelloWorld')
    expect(componentName).toBe('HelloWorld')
    expect(isIndex).toBeFalsy()
  })

  it('should return undefined if the entry is the root directory with index file', () => {
    const { componentName, isIndex } = resolvedComponentName('index')
    expect(componentName).toBeUndefined()
    expect(isIndex).toBeFalsy()
  })

  it('should return the base name of a file if there is no index in the path', () => {
    const { componentName, isIndex } = resolvedComponentName('components/Footer/Footer')
    expect(componentName).toBe('Footer')
    expect(isIndex).toBeFalsy()
  })

  it('should return undefined if there is no file name and the path is just a directory', () => {
    const { componentName, isIndex } = resolvedComponentName('components/hello-world/hello-world')
    expect(componentName).toBe('hello-world')
    expect(isIndex).toBeFalsy()
  })
})
