/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue reactivity', function() {
    it('updates refs, computed values and watchers', function() {
      expect(vm.count).to.equal(1)
      expect(vm.double).to.equal(2)
      vm.increment()
      expect(vm.count).to.equal(2)
      expect(vm.double).to.equal(4)
      expect(vm.watchCount).to.equal(1)
    })
  })
}
