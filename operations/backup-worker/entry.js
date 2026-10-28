// Provider entry point exports only runtime-supported handlers/classes. Helpers
// and constants in index.js remain importable by Node tests and operator tools.
import { DurableObject } from 'cloudflare:workers';
import worker, { BackupJob as BackupJobHandler } from './index.js';
export class BackupJob extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.job = new BackupJobHandler(state, env);
  }
  fetch(request) {
    return this.job.fetch(request);
  }
}
export default worker;
