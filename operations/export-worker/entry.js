import {PasswordWork as PasswordProvider} from '../auth-worker/password-work.js';
import {DurableObject} from 'cloudflare:workers';
import worker,{InventoryExport as Job} from './index.js';
export class InventoryExport extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.job=new Job(ctx,env);}
 fetch(request){return this.job.fetch(request);}
 alarm(){return this.job.alarm();}
}
export class PasswordWork extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.provider=new PasswordProvider();}
 fetch(request){return this.provider.fetch(request);}
}
export default worker;
