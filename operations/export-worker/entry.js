import { PasswordWork as PasswordProvider } from '../auth-worker/password-work.js';
import { createResourceMonitorAPI } from '../resource-monitor/index.js';
import { DurableObject } from 'cloudflare:workers';
import worker, { InventoryExport as Job } from './index.js';
export class InventoryExport extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.job = new Job(ctx, env);
  }
  fetch(request) {
    return this.job.fetch(request);
  }
  alarm() {
    return this.job.alarm();
  }
}
export class PasswordWork extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.provider = new PasswordProvider();
  }
  fetch(request) {
    return this.provider.fetch(request);
  }
}
export class ResourceMonitor extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.api = createResourceMonitorAPI({
      storage: ctx.storage,
      notify: async (payload) => {
        console.warn({ message: 'inventory_resource_alert', ...payload });
      },
    });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/resources/status' && request.method === 'GET')
      return this.api.handle(new Request('https://resources.internal/status'), this.env);
    if (url.pathname === '/resources/sample' && request.method === 'POST') {
      const result = await this.api.sample(this.env);
      if (!result.rateLimited) {
        const status = result.status;
        console.info({
          message: 'inventory_resource_sample',
          at: status.lastAttemptAt,
          health: status.health,
          states: {
            d1: status.metrics?.d1?.state || 'unknown',
            pages: status.metrics?.workers?.state || 'unknown',
            r2Operations: status.metrics?.r2Operations?.state || 'unknown',
            r2Storage: status.metrics?.r2Storage?.state || 'unknown',
          },
        });
      }
      return Response.json(result, {
        status: result.rateLimited ? 429 : result.ok ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response('Not found', { status: 404 });
  }
}
export default worker;
