import { WxmlService } from '@/context/WxmlService' // Adjust the import path as necessary

describe('wxmlService', () => {
  let service: WxmlService

  beforeEach(() => {
    service = new WxmlService()
  })

  it('should initialize with an empty map', () => {
    expect(service.map.size).toBe(0)
  })

  describe('addDeps', () => {
    it('should add dependencies for a new filepath', () => {
      service.addDeps('file1', ['dep1', 'dep2'])

      expect(service.map.has('file1')).toBe(true)
      expect(service.map.get('file1')).toEqual(new Set(['dep1', 'dep2']))
    })

    it('should add dependencies to an existing filepath', () => {
      service.addDeps('file1', ['dep1'])
      service.addDeps('file1', ['dep2', 'dep3'])

      expect(service.map.get('file1')).toEqual(new Set(['dep1', 'dep2', 'dep3']))
    })

    it('should not duplicate dependencies', () => {
      service.addDeps('file1', ['dep1', 'dep2'])
      service.addDeps('file1', ['dep2', 'dep3'])

      expect(service.map.get('file1')).toEqual(new Set(['dep1', 'dep2', 'dep3']))
    })

    it('should handle empty dependencies array', () => {
      service.addDeps('file1', [])

      expect(service.map.get('file1')).toEqual(new Set())
    })
  })

  describe('getAllDeps', () => {
    it('should return all unique dependencies and filepaths', () => {
      service.addDeps('file1', ['dep1', 'dep2'])
      service.addDeps('file2', ['dep2', 'dep3'])

      const allDeps = service.getAllDeps()

      expect(allDeps).toEqual(new Set(['file1', 'file2', 'dep1', 'dep2', 'dep3']))
    })

    it('should return an empty set when there are no dependencies', () => {
      const allDeps = service.getAllDeps()

      expect(allDeps.size).toBe(0)
    })
  })

  describe('clear', () => {
    it('should clear all entries in the map', () => {
      service.addDeps('file1', ['dep1', 'dep2'])
      service.addDeps('file2', ['dep3'])

      service.clear()

      expect(service.map.size).toBe(0)
    })
  })
})
