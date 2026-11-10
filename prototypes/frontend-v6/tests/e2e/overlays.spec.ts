import {test,expect,type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const product=pathToFileURL(resolve('dist/preview.html')).href;
const technical=pathToFileURL(resolve('dist-layout/layout-harness.html')).href;
async function openNav(page:Page) {
  await expect(page.getByTestId('app-shell')).toBeVisible();
  if (await page.evaluate(()=>window.innerWidth<700)) {
    const trigger=page.getByRole('button',{name:'Abrir navegación'});
    await expect(trigger).toBeVisible();await trigger.click();
    await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeVisible();
  }
}
async function workspace(page:Page) {await openNav(page);await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Ir al turno actual'}).click();}
async function topIds(page:Page) {return page.locator('[data-panel-mode=drawer][role=dialog]:visible').count();}

test('3A product · accesibilidad · primer Tab revela salto y Enter enfoca main',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(product);
  await expect(page.getByRole('main')).toBeVisible();
  await page.keyboard.press('Tab');
  const skip=page.getByRole('link',{name:'Saltar al contenido'});await expect(skip).toBeFocused();
  const box=await skip.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();
});

test('3A product · DESIGN-COMPLETE-03/04/05 · disclosure no modal, Tab/outside y destino exacto conectado',async ({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(product);await workspace(page);
  const more=page.getByRole('button',{name:'Más opciones'});
  await expect(more).toHaveAttribute('aria-expanded','false');
  await more.click();await expect(more).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#more-options')).not.toHaveAttribute('aria-modal','true');
  const theme=page.getByLabel('Apariencia');await expect(theme).toHaveValue('system');
  await expect(page.getByText('Datos sintéticos · Se reinician al recargar')).toBeVisible();
  await theme.focus();await page.keyboard.press('Escape');await expect(more).toBeFocused();
  await more.click();await theme.focus();await page.keyboard.press('Tab');
  await expect(more).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>document.activeElement?.closest('#more-options')===null)).toBe(true);
  await more.click();const target=page.getByRole('button',{name:'Lista 1',exact:true});const handle=await target.elementHandle();
  await target.click();await expect(target).toHaveAttribute('aria-expanded','false');await expect(more).toHaveAttribute('aria-expanded','false');
  expect(await target.evaluate((node,original)=>node===original,handle)).toBe(true);
  expect(await handle!.evaluate(node=>node.isConnected)).toBe(true);
});

test('3A product · UI-18 · fallo real restaura checkbox confirmado, sin activar fila',async ({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(product);await workspace(page);
  await page.getByRole('button',{name:'Más opciones'}).click();await page.getByRole('button',{name:'Demo local: datos sintéticos'}).click();
  await page.getByRole('button',{name:'Simular fallo'}).click();
  const task=page.getByRole('button',{name:'Tarea 1',exact:true});
  const other=page.getByRole('button',{name:'Revisar insumos',exact:true});
  await other.click();await expect(other).toHaveAttribute('aria-current','true');
  const check=task.locator('..').getByRole('checkbox');
  await expect(check).toHaveAccessibleName('Completar Tarea 1');
  await check.click();await expect(check).not.toBeChecked();await expect(check).toBeEnabled();
  await expect(check).toHaveAccessibleName('Completar Tarea 1');
  await expect(task).not.toHaveAttribute('aria-current','true');
  await expect(other).toHaveAttribute('aria-current','true');
  await check.click();await expect(check).toBeChecked();await expect(check).toHaveAccessibleName('Reabrir Tarea 1');
  await expect(task).not.toHaveAttribute('aria-current','true');
  await expect(other).toHaveAttribute('aria-current','true');
});

test('3A product · UI-12 INTERFACE-SKILLS-17 · Escape solo topmost, Demo reemplaza drawer y retorna visible',async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(product);
  const trigger=page.getByRole('button',{name:'Abrir navegación'});await trigger.click();
  const nav=page.getByRole('dialog',{name:'Navegación',exact:true});await expect(nav).toBeVisible();
  await page.getByRole('button',{name:'Más opciones'}).click();await page.getByLabel('Apariencia').focus();
  await page.keyboard.press('Escape');await expect(nav).toBeVisible();await expect(page.getByRole('button',{name:'Más opciones'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(nav).toBeHidden();await expect(trigger).toBeFocused();
  await trigger.click();await page.getByRole('button',{name:'Más opciones'}).click();await page.getByRole('button',{name:'Demo local: datos sintéticos'}).click();
  await expect(nav).toBeHidden();await expect(page.getByRole('dialog',{name:'Demostración local'})).toBeVisible();
  await page.getByRole('dialog',{name:'Demostración local'}).getByRole('button',{name:'Cerrar',exact:true}).click();
  await expect(trigger).toBeFocused();
});

test('3A product · docking cierra capas efímeras y no resucita drawers al estrechar',async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(product);await openNav(page);
  await page.getByRole('button',{name:'Más opciones'}).click();await page.getByLabel('Apariencia').focus();
  await page.setViewportSize({width:700,height:844});await expect(page.getByRole('button',{name:'Más opciones'})).toBeFocused();await expect(page.getByRole('button',{name:'Más opciones'})).toHaveAttribute('aria-expanded','false');await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode','column');
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeHidden();
  await workspace(page);await page.setViewportSize({width:999,height:844});
  const time=page.getByRole('button',{name:'Mostrar Tiempo'});await time.click();
  await expect(page.getByRole('dialog',{name:'Tiempo',exact:true})).toBeVisible();
  await page.setViewportSize({width:1000,height:844});await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode','column');
  await page.setViewportSize({width:999,height:844});await expect(page.getByRole('dialog',{name:'Tiempo',exact:true})).toBeHidden();
});

test('3A technical slots · EXTRA-NATIVE-EDIT · Back usa único controlador2B y solo capa superior',async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto(technical);
  await page.getByRole('button',{name:'Ensayar Inicio'}).click();await page.getByRole('button',{name:'Ensayar espacio'}).click();
  await openNav(page);await page.getByRole('button',{name:'Más opciones'}).click();
  await page.evaluate(()=>window.history.back());
  await expect(page.getByRole('button',{name:'Más opciones'})).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeVisible();
  await page.evaluate(()=>window.history.back());await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeHidden();
  await expect(page.getByRole('button',{name:'Abrir navegación'})).toBeFocused();
  expect(await topIds(page)).toBe(0);
});

test('3A technical slots · EXTRA-NATIVE-EDIT · tema con portal abierto conserva raw/error/foco y tokens',async ({page})=>{
  await page.setViewportSize({width:1000,height:768});await page.goto(technical);
  const input=page.getByRole('textbox',{name:'Estimación técnica'});await input.fill('abc');await input.blur();await expect(input).toHaveAttribute('aria-invalid','true');
  const body=page.getByRole('textbox',{name:'Borrador técnico'});const bodyHandle=await body.elementHandle();const raw=await body.inputValue();
  await page.getByRole('button',{name:'Más opciones'}).click();const select=page.getByLabel('Apariencia');await select.focus();
  for(const theme of ['dark','light']) {
    await select.selectOption(theme);await expect(select).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    const popup=page.locator('#more-options');
    const values=await popup.evaluate((node)=>{const style=getComputedStyle(node);return {background:style.backgroundColor,foreground:style.color,canvas:getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()};});
    expect(values.background).toBe(theme==='dark'?'rgb(23, 24, 23)':'rgb(255, 255, 255)');
    await expect(input).toHaveValue('abc');await expect(input).toHaveAttribute('aria-invalid','true');
    expect(await body.evaluate((node,original)=>node===original,bodyHandle)).toBe(true);await expect(body).toHaveValue(raw);
  }
});

function contrast(a:string,b:string) {
  const luminance=(color:string)=>{const channels=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const c=value/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});return channels[0]!*0.2126+channels[1]!*0.7152+channels[2]!*0.0722;};
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi!+0.05)/(lo!+0.05);
}
for(const theme of ['light','dark'] as const)test(`3A product · VISIBILITY-01/02/03 · hover/contraste reales ${theme}`,async({page},info)=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(product);
  await page.getByRole('button',{name:'Más opciones'}).click();await page.getByLabel('Apariencia').selectOption(theme);await page.keyboard.press('Escape');
  const measured: {surface:string;background:string;foreground:string;ratio:number}[]=[];
  const selected=page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Inicio',exact:true});await selected.hover();
  const background=theme==='light'?'rgb(34, 34, 34)':'rgb(217, 221, 215)';
  await expect(selected).toHaveCSS('background-color',background);
  let colors=await selected.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color}));expect(contrast(colors.bg,colors.fg)).toBeGreaterThanOrEqual(4.5);measured.push({surface:'selected-home-hover',background:colors.bg,foreground:colors.fg,ratio:contrast(colors.bg,colors.fg)});
  const primary=page.locator('.home button.primary');await primary.hover();await expect(primary).toHaveCSS('background-color',theme==='light'?'rgb(51, 51, 51)':'rgb(217, 221, 215)');
  colors=await primary.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color}));expect(contrast(colors.bg,colors.fg)).toBeGreaterThanOrEqual(4.5);measured.push({surface:'primary-home-hover',background:colors.bg,foreground:colors.fg,ratio:contrast(colors.bg,colors.fg)});
  await primary.click();const filter=page.getByRole('button',{name:'Todas',exact:true});await filter.hover();await expect(filter).toHaveCSS('background-color',theme==='light'?'rgb(234, 234, 234)':'rgb(53, 55, 53)');
  colors=await filter.evaluate(node=>({bg:getComputedStyle(node).backgroundColor,fg:getComputedStyle(node).color}));expect(contrast(colors.bg,colors.fg)).toBeGreaterThanOrEqual(4.5);measured.push({surface:'active-filter-hover',background:colors.bg,foreground:colors.fg,ratio:contrast(colors.bg,colors.fg)});
  await info.attach('computed-contrast',{body:JSON.stringify({theme,measured},null,2),contentType:'application/json'});
  await filter.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(filter).toBeFocused();expect(await filter.evaluate(node=>getComputedStyle(node).outlineWidth)).toBe('2px');
});

for (const width of [320,390,700,800,1440]) test(`3A product · fidelidad v5 drawer/disclosure · ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(product);
  await expect(page.getByRole('main')).toBeVisible();
  const time=page.getByRole('button',{name:'Mostrar Tiempo'});
  const timeBox=await time.boundingBox();expect(timeBox!.width).toBeGreaterThanOrEqual(44);expect(timeBox!.height).toBeGreaterThanOrEqual(44);
  if (width<700) {
    const trigger=page.getByRole('button',{name:'Abrir navegación'});
    const target=await trigger.boundingBox();expect(target!.width).toBeGreaterThanOrEqual(44);expect(target!.height).toBeGreaterThanOrEqual(44);
  }
  await openNav(page);
  const panel=page.locator('#navigation-panel');
  if (width<700) {
    const box=await panel.boundingBox();expect(box!.width).toBe(Math.min(340,width-20));
    const close=page.getByRole('button',{name:'Cerrar navegación'});
    await expect(close).toHaveText('');await expect(close.locator('svg')).toHaveAttribute('width','20');
    const target=await close.boundingBox();expect(target!.width).toBeGreaterThanOrEqual(44);expect(target!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button',{name:'Más opciones'}).click();
  const footer=page.locator('#navigation-panel .nav-footer');
  const popup=page.locator('#more-options');await expect(popup).toBeVisible();
  const footerBox=(await footer.boundingBox())!;
  await expect.poll(async()=> (await popup.boundingBox())!.width).toBe(footerBox.width);
  await expect.poll(async()=> (await popup.boundingBox())!.x).toBe(footerBox.x);
  const information=await popup.locator('p').evaluate(node=>{const style=getComputedStyle(node);return {fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight)};});
  expect(information.lineHeight/information.fontSize).toBeCloseTo(1.4,5);
  const labelMargins=await popup.locator('.theme-control').evaluate(node=>{const style=getComputedStyle(node);return [style.marginTop,style.marginRight,style.marginBottom,style.marginLeft];});
  const expectedMargins=width<700?['20px','0px','6px','0px']:['0px','0px','0px','0px'];
  expect(labelMargins).toEqual(expectedMargins);
  const values=await popup.evaluate(node=>({anchor:getComputedStyle(node).getPropertyValue('--anchor-width'),width:getComputedStyle(node).width,maxHeight:getComputedStyle(node).maxHeight}));
  const expectedMaxHeight=`${await page.evaluate(()=>window.innerHeight)-120}px`;
  expect(values.maxHeight).toBe(expectedMaxHeight);
  await info.attach('drawer-disclosure-geometry',{body:JSON.stringify({viewport:width,panel:await panel.boundingBox(),footer:footerBox,popup:await popup.boundingBox(),values,information,labelMargins,expected:{lineHeightRatio:1.4,labelMargins:expectedMargins,maxHeight:expectedMaxHeight}},null,2),contentType:'application/json'});
  await page.keyboard.press('Escape');
  if (width<700) await page.keyboard.press('Escape');
  await expect(page.getByRole('main')).toBeVisible();
});

for (const width of [390,1440]) for (const theme of ['light','dark'] as const) test(`3A product · iconos auditados I1–I5 · ${width}px ${theme}`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(product);await workspace(page);await openNav(page);
  await page.getByRole('button',{name:'Más opciones'}).click();
  const initialAppearance=page.getByLabel('Apariencia');await initialAppearance.focus();await initialAppearance.selectOption(theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await expect(initialAppearance).toBeFocused();await page.keyboard.press('Escape');
  const search=page.getByRole('searchbox',{name:'Buscar tareas'}).locator('..').locator('svg');
  const searchBox=(await search.boundingBox())!;expect([searchBox.width,searchBox.height]).toEqual([20,20]);
  const nav=page.getByRole('navigation',{name:'Principal'});
  for (const name of ['Lista 1','Editar nombre de Lista 1','Agregar tarea a Lista 1']) {
    const svg=nav.getByRole('button',{name,exact:true}).locator('svg');const box=(await svg.boundingBox())!;
    expect([box.width,box.height]).toEqual([20,20]);await expect(svg).toHaveAttribute('aria-hidden','true');
  }
  await nav.getByRole('button',{name:'Lista 2',exact:true}).click();
  const priority=nav.locator('.priority-badge svg'), agendaPriority=page.locator('.agenda .priority-badge svg');
  for(const icon of [priority,agendaPriority]) {await expect(icon).toHaveCount(1);await expect(icon).toHaveAttribute('width','14');await expect(icon).toHaveAttribute('height','14');await expect(icon).toHaveAttribute('aria-hidden','true');await expect(icon.locator('path')).toHaveAttribute('d','M12 19V5m-6 6 6-6 6 6');}
  await expect(page.getByRole('button',{name:/Revisar material/})).toHaveAccessibleName(/Prioridad Alta/);
  const typography=await nav.evaluate(node=>{
    const read=(element:Element)=>{const style=getComputedStyle(element);return {fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),fontWeight:style.fontWeight,flexWrap:style.flexWrap,gap:style.gap,whiteSpace:style.whiteSpace,padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft]};};
    const badge=node.querySelector('.priority-badge')!;
    return {shift:read(node.querySelector('.shift-button')!),context:read(node.querySelector('.shift-context strong')!),actions:Array.from(node.querySelectorAll('.nav-actions .nav-item'),read),task:read(badge.parentElement!),priority:read(badge)};
  });
  const expectedTypography={shiftWeight:'400',contextWeight:'600',actionWrap:'wrap',actionGap:width<=1100?'4px':'6px',actionPaddingInline:width<=1100?'4px':'8px',lineHeightRatio:1.4,taskPadding:['6px','2px','6px','2px'],priority:{gap:'2px',weight:'600',whiteSpace:'nowrap'}};
  await info.attach('source-navigation-typography',{body:JSON.stringify({viewport:width,theme,measured:typography,expected:expectedTypography},null,2),contentType:'application/json'});
  expect(typography.shift.fontWeight).toBe(expectedTypography.shiftWeight);expect(typography.context.fontWeight).toBe(expectedTypography.contextWeight);
  for(const action of typography.actions) {expect(action.flexWrap).toBe(expectedTypography.actionWrap);expect(action.gap).toBe(expectedTypography.actionGap);expect([action.padding[1],action.padding[3]]).toEqual([expectedTypography.actionPaddingInline,expectedTypography.actionPaddingInline]);expect(action.lineHeight/action.fontSize).toBeCloseTo(1.4,5);}
  expect(typography.task.padding).toEqual(expectedTypography.taskPadding);expect(typography.task.lineHeight/typography.task.fontSize).toBeCloseTo(1.4,5);
  expect(typography.priority.gap).toBe('2px');expect(typography.priority.fontWeight).toBe('600');expect(typography.priority.whiteSpace).toBe('nowrap');expect(typography.priority.lineHeight/typography.priority.fontSize).toBeCloseTo(1.4,5);
  await page.getByRole('button',{name:'Más opciones'}).click();
  const demo=page.getByRole('button',{name:'Demo local: datos sintéticos'}).locator('svg');
  const demoBox=(await demo.boundingBox())!;expect([demoBox.width,demoBox.height]).toEqual([20,20]);
  const footer=page.getByRole('button',{name:'Más opciones'}).locator('svg');
  const footerBox=(await footer.boundingBox())!;expect([footerBox.width,footerBox.height]).toEqual([16,16]);
  const appearance=page.getByLabel('Apariencia');await expect(appearance).toHaveValue(theme);
  await page.keyboard.press('Escape');
  await info.attach('icon-measurements',{body:JSON.stringify({viewport:width,theme,search:searchBox,demo:demoBox,footer:footerBox,priority:await priority.boundingBox()},null,2),contentType:'application/json'});
  await page.screenshot({path:info.outputPath(`icons-${width}-${theme}.png`),fullPage:true});
});


for (const method of ['pointer','keyboard'] as const) test(`3A product · disclosure al estrechar700→699 por ${method} cierra y devuelve foco visible`,async({page})=>{
  await page.setViewportSize({width:700,height:844});await page.goto(product);await expect(page.getByRole('main')).toBeVisible();
  const more=page.getByRole('button',{name:'Más opciones'});
  const original=await more.elementHandle();
  if (method==='keyboard') {await more.focus();await more.press('Enter');} else await more.click();
  await page.getByLabel('Apariencia').focus();
  await page.setViewportSize({width:699,height:844});
  // The accessible trigger is intentionally absent from AX while its drawer is hidden.
  // Inspect the same connected DOM node, without weakening the visible focus oracle.
  expect(await original!.evaluate(node=>node.isConnected)).toBe(true);
  await expect.poll(()=>original!.getAttribute('aria-expanded')).toBe('false');
  await expect(page.locator('#more-options')).toBeHidden();
  await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeHidden();
  await expect(page.getByRole('button',{name:'Abrir navegación'})).toBeFocused();
  await expect(page.getByRole('main')).toBeVisible();
});


test('3A product · disclosure en viewport bajo conserva límite v5 y selector alcanzable por teclado',async({page},info)=>{
  await page.setViewportSize({width:390,height:280});await page.goto(product);await openNav(page);
  const more=page.getByRole('button',{name:'Más opciones'});await more.click();
  const popup=page.locator('#more-options');await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS('max-height','160px');
  expect(await popup.evaluate(node=>node.scrollHeight>node.clientHeight)).toBe(true);
  await popup.getByRole('button',{name:'Demo local: datos sintéticos'}).focus();
  await page.keyboard.press('Tab');
  const appearance=page.getByLabel('Apariencia');await expect(appearance).toBeFocused();await expect(appearance).toBeInViewport({ratio:1});
  const panelBox=(await popup.boundingBox())!,selectBox=(await appearance.boundingBox())!;
  expect(selectBox.y).toBeGreaterThanOrEqual(panelBox.y);expect(selectBox.y+selectBox.height).toBeLessThanOrEqual(panelBox.y+panelBox.height);
  const measured=await popup.evaluate(node=>({scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,maxHeight:getComputedStyle(node).maxHeight}));
  await info.attach('low-viewport-scroll',{body:JSON.stringify({viewport:{width:390,height:280},popup:panelBox,selector:selectBox,measured,expectedMaxHeight:'160px'},null,2),contentType:'application/json'});
  await page.keyboard.press('Escape');await expect(more).toBeFocused();
});
