// Native entry exports only provider-supported handlers and classes.
import { DurableObject } from 'cloudflare:workers';
import worker, { InventoryRealtime as Watcher } from './index.js';
export class InventoryRealtime extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.watcher = new Watcher(state, env);
  }
  fetch(request) {
    return this.watcher.fetch(request);
  }
  alarm() {
    return this.watcher.alarm();
  }
  webSocketMessage(socket, message) {
    return this.watcher.webSocketMessage(socket, message);
  }
  webSocketClose(socket, code, reason, wasClean) {
    return this.watcher.webSocketClose(socket, code, reason, wasClean);
  }
  webSocketError(socket, error) {
    return this.watcher.webSocketError(socket, error);
  }
}
export default worker;
