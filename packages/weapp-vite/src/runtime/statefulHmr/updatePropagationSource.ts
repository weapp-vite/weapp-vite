/** 使用补丁执行前的已执行模块图计算边界；Rolldown 只提供工厂与依赖图，不代替宿主传播更新。 */
export const statefulHmrUpdatePropagationSource = `
  prepareUpdate(changedIds) {
    const uniqueIds = [...new Set(changedIds.filter((id) => typeof id === 'string'))];
    const updateSet = new Set();
    const boundaries = new Map();
    const addBoundary = (boundary, acceptedVia) => {
      const key = JSON.stringify([boundary, acceptedVia]);
      if (!boundaries.has(key)) {
        const callbacks = this.contexts.get(boundary)?.callbacks.filter(({ deps }) =>
          Array.isArray(deps) ? deps.includes(acceptedVia) : deps === acceptedVia
        ) ?? [];
        boundaries.set(key, { boundary, acceptedVia, callbacks: [...callbacks] });
      }
    };
    for (const changed of uniqueIds) {
      if (!this.isExecuted(changed)) continue;
      const pending = [changed];
      const visited = new Set();
      let accepted = false;
      while (pending.length) {
        const id = pending.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        updateSet.add(id);
        const selfAccepted = this.contexts.get(id)?.callbacks.some(({ deps }) =>
          Array.isArray(deps) ? deps.includes(id) : deps === id
        );
        if (selfAccepted) {
          addBoundary(id, id);
          accepted = true;
          continue;
        }
        const parents = this.getImporters(id).filter((parent) => this.isExecuted(parent));
        if (!parents.length) throw new Error('HMR update has no accepting importer: ' + id);
        for (const parent of parents) {
          const dependencyAccepted = this.contexts.get(parent)?.callbacks.some(({ deps }) =>
            Array.isArray(deps) ? deps.includes(id) : deps === id
          );
          if (dependencyAccepted) {
            addBoundary(parent, id);
            accepted = true;
          } else pending.push(parent);
        }
      }
      if (!accepted) throw new Error('HMR update has no accepting boundary: ' + changed);
    }
    return { changedIds: uniqueIds, updateSet: [...updateSet], boundaries: [...boundaries.values()] };
  }
  applyPreparedUpdate(update) {
    const summary = { changedIds: update.changedIds, initialized: [], missing: [], executedBefore: [], executedAfterRemove: [] };
    for (const id of update.updateSet) {
      if (!this.hasFactory(id)) summary.missing.push(id);
      if (this.isExecuted(id)) summary.executedBefore.push(id);
    }
    if (summary.missing.length) throw new Error('HMR update is missing factories: ' + summary.missing.join(', '));
    for (const id of update.updateSet) {
      this.removeModuleCache(id);
      if (this.isExecuted(id)) summary.executedAfterRemove.push(id);
    }
    for (const { acceptedVia, callbacks } of update.boundaries) {
      this.initModule(acceptedVia);
      const fresh = this.loadExports(acceptedVia);
      for (const { deps, callback } of callbacks) {
        if (callback) callback(Array.isArray(deps) ? deps.map((id) => id === acceptedVia ? fresh : undefined) : fresh);
      }
    }
    summary.initialized = update.updateSet.filter((id) => this.isExecuted(id));
    return summary;
  }
`
