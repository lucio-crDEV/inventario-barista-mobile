import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Client, database, origin, password, updateUser } from "./helpers.mjs";
const db=database();db.exec("DELETE FROM attempts");
const admin=new Client();await admin.login("admin-prueba");
const browser=await chromium.launch({headless:true}), contexts=[],errors=[],checks=[];
const screenshotDirectory="test-results/users-service";
await mkdir(screenshotDirectory,{recursive:true});
async function session(username) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});contexts.push(context);
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/pages/cuenta/");
  await page.locator("[name=username]").fill(username);await page.locator("[name=password]").fill(password);
  const requests=[];page.on("request",r=>{const p=new URL(r.url()).pathname;if(p.startsWith("/api/"))requests.push(p);});
  await page.getByRole("button",{name:"Ingresar",exact:true}).click();
  await page.waitForURL(u=>!u.pathname.startsWith("/pages/cuenta"));
  await expect(page.locator(".identity-bar")).toBeAttached();
  return{context,page,requests};
}
const users=async()=> (await admin.request("/api/admin/users")).data.users;
let name="ui-serv-"+Date.now(), createdId;
try {
  const lead=await session("jefa-servicio-2");
  await expect(lead.page).toHaveURL(/area=servicio$/);
  await expect(lead.page.locator("#header-back-to-categories")).toBeHidden();
  await expect(lead.page.locator(".scope-card")).toHaveCount(5);
  await expect(lead.page.locator(".scope-card")).toContainText(["Garzones","Mercadito","Barra","Línea / Armado","Copería"]);
  assert.deepEqual(lead.requests.filter(p=>p!=="/api/me"),["/api/login","/api/bootstrap"]);
  await lead.page.locator('[data-settings-toggle]').click();
  await expect(lead.page.locator(".identity-person")).toContainText("Jefa de servicio");
  await lead.page.getByRole("link",{name:"Usuarios y accesos",exact:true}).click();
  await expect(lead.page.locator("#user-search")).toBeVisible();
  assert.equal(await lead.page.locator('[value="cocina"],[value="pasteleria"],[value="principal"],[value="panaderia"]').count(),0);
  assert.ok(!(await lead.page.locator("#users").innerText()).includes("Administrador ficticio"));
  checks.push("Jefa entra en cinco subáreas sin flecha global ni petición de navegación adicional; administración filtrada");

  const create=lead.page.locator("#create");await lead.page.locator(".create-user summary").click();
  await create.locator('[name=username]').fill(name);await create.locator('[name=name]').fill("Persona UI Servicio");await create.locator('[name=password]').fill(password);
  await create.getByRole("button",{name:"Crear usuario",exact:true}).click();
  await expect(lead.page.locator("#message")).toContainText("Cambios guardados");
  createdId=(await users()).find(u=>u.username===name).id;
  await lead.page.locator("#user-search").fill(name);await lead.page.locator(".user-card:visible > .user-details > summary").click();
  let form=lead.page.locator(`form[data-user="${createdId}"]`);
  await expect(form.locator('[name=name]')).toHaveCount(0);
  await expect(form.locator('[name=username]')).toHaveValue(name);
  await form.locator("..").getByRole("tab", {name:"Accesos", exact:true}).click();
  await form.locator('.scope-group[data-scope="servicio"] > summary').click();
  await form.locator('[value="servicio:barra"]').check();await form.locator('[value="servicio:coperia"]').check();
  await form.getByRole("button",{name:"Guardar cuenta y accesos"}).click();
  await expect(lead.page.locator("#message")).toContainText("Cambios guardados");
  checks.push("Crear conserva nombre inicial; editar cambia username y ámbitos de Servicio, sin editor administrativo del nombre visible");

  await lead.page.locator("#user-search").fill(name);await lead.page.locator(".user-card:visible > .user-details > summary").click();
  await lead.page.locator(`.user-card[data-id="${createdId}"]`).getByRole("tab", {name:"Seguridad", exact:true}).click();
  const remove=lead.page.locator(`[data-delete="${createdId}"]`);
  await remove.click();await expect(lead.page.getByRole("dialog")).toContainText("irreversible");
  await expect(lead.page.locator("#cancel-delete")).toBeFocused();
  await lead.page.keyboard.press("Escape");await expect(lead.page.getByRole("dialog")).toHaveCount(0);
  await expect(remove).toBeFocused();assert.ok((await users()).some(u=>u.id===createdId));
  for(const theme of ["light","dark"]){
    await lead.page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await remove.click();
    await lead.page.getByRole("dialog").evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
    await expect(lead.page.getByRole("dialog")).toHaveCSS("opacity","1");
    assert.ok(await lead.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await lead.page.screenshot({path:`${screenshotDirectory}/eliminar-${theme}.png`});
    await lead.page.locator("#cancel-delete").click();
  }
  // A previous confirmation does not authorize deleting a newly edited account.
  await remove.click();assert.equal((await updateUser(admin,name,{active:false})).status,200);
  await lead.page.locator("#confirm-delete").click();
  await expect(lead.page.locator("#message")).toContainText("cambió");
  assert.ok((await users()).some(u=>u.id===createdId));
  await lead.page.reload();await lead.page.locator("#user-search").fill(name);await lead.page.locator(".user-card:visible > .user-details > summary").click();
  await lead.page.locator(`.user-card[data-id="${createdId}"]`).getByRole("tab", {name:"Seguridad", exact:true}).click();
  await lead.page.locator(`[data-delete="${createdId}"]`).click();await lead.page.locator("#confirm-delete").click();
  await expect(lead.page.locator("#message")).toContainText("Usuario eliminado");
  assert.ok(!(await users()).some(u=>u.id===createdId));
  checks.push("Diálogo irreversible en ambos temas: Cancelar/foco/Escape; versión cambiada impide borrar, nueva confirmación elimina");

  const worker=await session("ana");
  await expect(worker.page).toHaveURL(/sector=barra$/);
  await worker.page.locator('[data-settings-toggle]').click();await worker.page.getByRole("link",{name:"Mi perfil",exact:true}).click();
  await expect(worker.page.locator("#account-content h2")).toHaveText("Mi perfil");
  await expect(worker.page.locator('[name=username]')).toHaveCount(0);
  const oldName=(await (await worker.context.request.get(origin+"/api/me")).json()).user.name;
  await worker.page.locator('[name=name]').fill("Mi nombre visible UI");await worker.page.getByRole("button",{name:"Guardar nombre visible"}).click();
  await expect(worker.page.locator("#message")).toContainText("Nombre visible actualizado");
  await expect(worker.page.locator(".identity-person")).toContainText("Mi nombre visible UI");
  const current=(await (await worker.context.request.get(origin+"/api/me")).json()).user;
  assert.equal(current.username,"ana");
  for(const width of [320,390,1024])for(const theme of ["light","dark"]){
    await worker.page.setViewportSize({width,height:844});await worker.page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.ok(await worker.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await worker.page.screenshot({path:`${screenshotDirectory}/perfil-${width}-${theme}.png`});
  }
  const restored=await worker.context.request.post(origin+"/api/profile",{headers:{Origin:origin,"X-Inventory-User":current.id},data:{name:oldName,expectedRevision:current.revision}});assert.equal(restored.status(),200);
  checks.push("Cada trabajador cambia su nombre visible, conserva usuario y actualiza menú; perfil 320/390/1024 en claro/oscuro");

  assert.equal((await updateUser(admin,"sin-areas",{grants:["pasteleria"]})).status,200);
  const single=await session("sin-areas");await expect(single.page).toHaveURL(/area=pasteleria$/);await expect(single.page.locator(".category-card").first()).toBeVisible();
  await expect(single.page.locator("#header-back-to-categories")).toBeHidden();
  assert.equal((await updateUser(admin,"sin-areas",{grants:["cocina","pasteleria"]})).status,200);
  await single.page.goto(origin+"/");await expect(single.page.locator("nav a")).toHaveCount(2);
  assert.equal((await updateUser(admin,"sin-areas",{grants:["servicio:garzones:privada"]})).status,200);
  await single.page.goto(origin+"/");await expect(single.page).toHaveURL(/area=servicio&sector=garzones$/);
  await expect(single.page.locator(".scope-card")).toHaveCount(1);await expect(single.page.locator(".scope-card")).toContainText("Zona privada");
  await single.page.locator(".scope-card").click();await expect(single.page.locator("#quantity")).toBeVisible();
  await single.page.locator("#header-back-to-categories").click();await expect(single.page.locator(".scope-card")).toHaveCount(1);
  checks.push("Área única entra a categorías, dos áreas muestran Inicio y Garzones conserva solo sus zonas y regreso útil");
  assert.equal((await updateUser(admin,"sin-areas",{grants:[]})).status,200);

  await lead.page.goto(origin+"/pages/inventario/?area=servicio&sector=coperia");
  await expect(lead.page.locator(".category-card")).toHaveCount(1);await expect(lead.page.locator(".category-card")).toContainText("Aseo");
  await lead.page.goto(origin+"/pages/inventario/?area=servicio&sector=mercadito");
  await expect(lead.page.locator(".category-card")).toHaveCount(3);
  await expect(lead.page.locator(".category-card")).toContainText(["Desechables","Productos Elaborados","Vitrina"]);
  await lead.page.locator(".category-card").filter({hasText:"Vitrina"}).click();
  await expect(lead.page.locator("#quantity")).toBeVisible();
  await lead.page.screenshot({path:`${screenshotDirectory}/vitrina.png`});
  checks.push("Copería muestra Aseo y Mercadito distingue Desechables, Productos Elaborados y Vitrina");
  assert.deepEqual(errors,[]);
  await writeFile("docs/usuarios-servicio-vistas-3b.json",JSON.stringify({environment:"Chromium móvil + Workers/D1 local",date:"2026-10-22",checks,errors,passed:true,physicalDevice:false},null,2)+"\n");
  console.log(JSON.stringify({checks,errors},null,2));
}finally{await updateUser(admin,"sin-areas",{grants:[]}).catch(()=>{});await browser.close();db.close();}
