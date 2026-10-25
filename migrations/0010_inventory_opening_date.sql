-- Stamp a prepared inventory with the actual date on activation. Existing data is unchanged.
DROP TRIGGER apply_inventory_cycle;
CREATE TRIGGER apply_inventory_cycle AFTER INSERT ON inventory_cycle_commands BEGIN
 INSERT INTO cycles(id,name,catalog_version,state,type,period,lifecycle,created_at,activated_at)
 SELECT NEW.cycle_id,NEW.name,NEW.catalog_version,CASE WHEN NEW.activate=1 THEN 'open' ELSE 'review' END,NEW.type,NEW.period,CASE WHEN NEW.activate=1 THEN 'active' ELSE 'prepared' END,NEW.created_at,CASE WHEN NEW.activate=1 THEN NEW.created_at ELSE NULL END WHERE NEW.kind='create';
 UPDATE cycles SET name=CASE WHEN NEW.kind='activate' THEN NEW.name ELSE name END,period=CASE WHEN NEW.kind='activate' THEN NEW.period ELSE period END,lifecycle=CASE WHEN NEW.kind='delete' THEN 'deleted' ELSE 'active' END,state=CASE WHEN NEW.kind='activate' THEN 'open' ELSE state END,revision=revision+1,activated_at=CASE WHEN NEW.kind='activate' THEN NEW.created_at ELSE activated_at END,deleted_at=CASE WHEN NEW.kind='delete' THEN NEW.created_at ELSE deleted_at END WHERE id=NEW.cycle_id AND NEW.kind!='create';
 UPDATE cycle_registry SET revision=revision+1 WHERE id=1;
 UPDATE inventory_cycle_commands SET result=json_object('id',NEW.id,'cycle',json((SELECT json_object('id',id,'name',name,'catalog_version',catalog_version,'state',state,'revision',revision,'type',type,'period',period,'lifecycle',lifecycle,'created_at',created_at,'activated_at',activated_at,'deleted_at',deleted_at) FROM cycles WHERE id=NEW.cycle_id))) WHERE id=NEW.id;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'inventory-cycle-'||NEW.kind,json_object('commandId',NEW.id,'beforeRevision',NEW.expected_revision,'result',json((SELECT result FROM inventory_cycle_commands WHERE id=NEW.id)),'warningsConfirmed',NEW.confirm_warnings,'confirmationRevision',NEW.confirmation_revision));
END;
