import {test, expect, type Page} from '@playwright/test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readPngPixel} from './support/png';

const product = pathToFileURL(resolve('dist/preview.html')).href;
const fixture = `${pathToFileURL(resolve('dist-layout/layout-harness.html')).href}?fixture=product-long`;
const technical = pathToFileURL(resolve('dist-layout/layout-harness.html')).href;
async function navigation(page: Page) {
  if (await page.evaluate(()=>window.innerWidth<700)) {
    const trigger = page.getByRole('button', {name: 'Abrir navegación'});
    await expect(trigger).toBeVisible();await trigger.click();
    await expect(page.getByRole('dialog',{name:'Navegación',exact:true})).toBeVisible();
  }
}
async function appearance(page: Page, value: 'light'|'dark') {
  await navigation(page);
  await page.getByRole('button', {name: 'Más opciones'}).click();
  await page.getByLabel('Apariencia').selectOption(value);
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
  await page.keyboard.press('Escape');
  if (await page.getByRole('dialog', {name: 'Navegación', exact: true}).isVisible()) await page.keyboard.press('Escape');
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const zone of await page.locator('.workspace,.toolbar,.navigation,.editor-slot,.editor,.home').all()) {
    if (await zone.isVisible()) expect(await zone.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
}

test.beforeEach(async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => /^(file:|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
  Object.assign(page, {layoutErrors: errors});
});
test.afterEach(async ({page}) => {
  expect(Reflect.get(page, 'layoutErrors')).toEqual([]);
});

for (const width of [320,390,699,700,999,1000,1024,1440]) {
  for (const theme of ['light','dark'] as const) test(`3A product · ${width}px ${theme} · EMIL-SKILLS-13 INTERFACE-SKILLS-19 TOKENS-02`, async ({page}, info) => {
    await page.setViewportSize({width,height:844});
    await page.goto(product);
    await expect(page.getByRole('heading', {name:'Hola, Demo.'})).toBeVisible();
    await appearance(page,theme);
    await noOverflow(page);
    const meta = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(meta).toContain('viewport-fit=cover'); expect(meta).toContain('interactive-widget=resizes-content');
    expect(meta).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
    await navigation(page);
    const brand = page.getByRole('button', {name:'Turno · Inicio'});
    await expect(brand).toBeVisible();
    const mobileRules=await page.evaluate(()=>{
      const html=getComputedStyle(document.documentElement),button=getComputedStyle(document.querySelector('.brand-button')!);
      return {tap:html.getPropertyValue('-webkit-tap-highlight-color'),textAdjust:html.getPropertyValue('text-size-adjust'),webkitTextAdjust:html.getPropertyValue('-webkit-text-size-adjust'),userSelect:button.userSelect,webkitUserSelect:button.getPropertyValue('-webkit-user-select'),calloutSupported:CSS.supports('-webkit-touch-callout','none'),callout:button.getPropertyValue('-webkit-touch-callout')};
    });
    expect(mobileRules).toMatchObject({tap:'rgba(0, 0, 0, 0)',textAdjust:'100%',webkitTextAdjust:'100%',userSelect:'none',webkitUserSelect:'none'});
    const calloutDeclared=/-webkit-touch-callout\s*:\s*none/.test(readFileSync(resolve('src/styles/layout.css'),'utf8'));
    expect(calloutDeclared).toBe(true); // structural preservation, not proof of iOS behavior
    if(mobileRules.calloutSupported) expect(mobileRules.callout).toBe('none');
    await info.attach('mobile-rules-computed',{body:JSON.stringify({measured:mobileRules,calloutDeclared,calloutEvidence:mobileRules.calloutSupported?'computed in this engine':'source declaration only; Chromium does not support it; no iOS runtime claim'},null,2),contentType:'application/json'});
    expect(await brand.locator('span').evaluate((node) => getComputedStyle(node).fontSize)).toBe('0px');
    await expect(page.locator('.brand-flower')).toHaveJSProperty('naturalWidth',512);
    const expected = width >= 700 ? 'column' : 'drawer';
    await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode',expected);
    await noOverflow(page);
    await page.screenshot({path:info.outputPath(`product-${width}-${theme}.png`),fullPage:true});
  });
}

test('3A product · regresión play preexistente · máscara SVG válida y esquina transparente, no cuadrado',async ({page},info)=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(product);
  const primary=page.locator('.home button.primary');await expect(primary).toBeVisible();
  const icon=primary.locator('.icon');
  expect(await icon.evaluate(node=>getComputedStyle(node).maskImage)).not.toBe('none');
  const background=await primary.evaluate(node=>getComputedStyle(node).backgroundColor.match(/\d+/g)!.slice(0,3).map(Number));
  const corner=readPngPixel(await icon.screenshot(),0,0);
  expect([corner.r,corner.g,corner.b]).toEqual(background);
  const foreground=await icon.evaluate(node=>getComputedStyle(node).color.match(/\d+/g)!.slice(0,3).map(Number));
  const pixels=await icon.screenshot();
  const width=readPngPixel(pixels,0,0).width;
  const stroke=readPngPixel(pixels,Math.floor(width*5/24),Math.floor(width/2));
  const center=readPngPixel(pixels,Math.floor(width/2),Math.floor(width/2));
  expect([center.r,center.g,center.b]).toEqual(background); // outline remains hollow
  const luminance=(rgb:number[])=>{const c=rgb.map(value=>{const channel=value/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;});return c[0]!*0.2126+c[1]!*0.7152+c[2]!*0.0722;};
  const bg=luminance(background),fg=luminance(foreground),paint=luminance([stroke.r,stroke.g,stroke.b]);
  const ratio=(Math.max(paint,bg)+0.05)/(Math.min(paint,bg)+0.05);
  await info.attach('play-crop',{body:pixels,contentType:'image/png'});
  await info.attach('play-measured',{body:JSON.stringify({foreground,background,corner:[corner.r,corner.g,corner.b],center:[center.r,center.g,center.b],stroke:[stroke.r,stroke.g,stroke.b],strokePoint:[Math.floor(width*5/24),Math.floor(width/2)],ratio},null,2),contentType:'application/json'});
  expect(Math.sign(paint-bg)).toBe(Math.sign(fg-bg));
  expect(ratio).toBeGreaterThanOrEqual(3); // visible antialiased stroke
});

test('3A product fixture · INTERFACE-SKILLS-16/32/33 · 300 caracteres, altura baja',async ({page}) => {
  // Real App + real session/store/port, injected synthetic boundary data. No editor/Agenda slot.
  for (const width of [320,390,699,700,999,1000,1024,1440]) {
    await page.setViewportSize({width,height:480}); await page.goto(fixture);
    await expect(page.getByRole('main')).toBeVisible();
    await noOverflow(page);
    expect(await page.locator('.toolbar-title').evaluate((node) => getComputedStyle(node).textOverflow)).not.toBe('ellipsis');
    const close = page.getByRole('button',{name:'Cerrar turno',exact:true});
    const box = await close.boundingBox(); expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (width < 400) {
      const hiddenLabel = await close.locator('span').evaluate((node) => {const style=getComputedStyle(node);return {width:style.width,height:style.height,clip:style.clipPath};});
      expect(hiddenLabel).toEqual({width:'1px',height:'1px',clip:'inset(50%)'});
    }
    await navigation(page);
    const actions = page.locator('.nav-actions');
    expect(await actions.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
    await noOverflow(page);
  }

});

test('3A product fixture · DESIGN-AUDIT-02 · áreas 44px nativas separadas y forced-colors',async ({page}) => {
  await page.setViewportSize({width:1024,height:768}); await page.goto(fixture);
  const check = page.getByRole('navigation', {name: 'Principal'}).getByRole('checkbox').first();
  const label = check.locator('..'); const row = label.locator('..');
  await expect(label).toHaveJSProperty('tagName','LABEL');
  await expect(label.locator('input,button')).toHaveCount(1);
  const labelBox=await label.boundingBox(), buttonBox=await row.locator('.task-button').boundingBox();
  expect(labelBox!.width).toBe(44);expect(labelBox!.height).toBe(44);
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
  expect(labelBox!.x+labelBox!.width).toBeLessThanOrEqual(buttonBox!.x);
  await page.emulateMedia({forcedColors:'active'});
  expect(await check.evaluate((node) => getComputedStyle(node).appearance)).toBe('auto');
});

test('3A product fixture · INTERFACE-SKILLS-18 · cue depende del contenido inferior real',async ({page},info) => {
  await page.setViewportSize({width:390,height:480});await page.goto(fixture);await navigation(page);
  const scroll=page.getByTestId('nav-scroll');
  expect(await scroll.evaluate((node)=>node.scrollHeight>node.clientHeight)).toBe(true);
  await expect(scroll).toHaveClass(/has-more/);
  const readMask=()=>scroll.evaluate(node=>{const style=getComputedStyle(node);return {mask:style.maskImage,webkitMask:style.getPropertyValue('-webkit-mask-image')};});
  const theme=await page.locator('html').getAttribute('data-theme');
  const expectedInk=theme==='dark'?'rgb(242, 243, 240)':'rgb(17, 17, 17)';
  const expectedGradient=`linear-gradient(${expectedInk} calc(100% - 40px), rgba(0, 0, 0, 0))`;
  const above=await readMask();expect(above).toEqual({mask:expectedGradient,webkitMask:expectedGradient});
  await scroll.evaluate((node)=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});
  await expect(scroll).not.toHaveClass(/has-more/);
  const bottom=await readMask();expect(bottom).toEqual({mask:'none',webkitMask:'none'});
  await scroll.evaluate((node)=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});
  await expect(scroll).toHaveClass(/has-more/);
  const restored=await readMask();expect(restored).toEqual(above);
  await info.attach('scroll-cue-computed',{body:JSON.stringify({theme,expectedGradient,above,bottom,restored},null,2),contentType:'application/json'});
});

test('3A technical slots · EXTRA-NATIVE-EDIT · docking conserva nodo, raw, caret, undo, scroll y propiedad',async ({page}) => {
  await page.setViewportSize({width:1000,height:768});await page.goto(technical);
  const body=page.getByRole('textbox',{name:'Borrador técnico'});
  const handle=await body.elementHandle();
  const estimate=page.getByRole('textbox',{name:'Estimación técnica'});
  await estimate.fill('abc');await estimate.blur();await expect(estimate).toHaveAttribute('aria-invalid','true');
  await body.fill('Texto literal <b>sin HTML</b>\nLínea larga '.repeat(30));
  await body.focus();await body.evaluate((node:HTMLTextAreaElement)=>node.setSelectionRange(node.value.length,node.value.length));
  // Native undo belongs to the latest edit across the document, not to an isolated field stack.
  // Keep body as the last edited control before testing body undo across docking.
  await page.keyboard.type(' SUFIJO');
  const written=await body.inputValue();
  await body.evaluate((node:HTMLTextAreaElement)=>{node.setSelectionRange(3,12);node.scrollTop=35;});
  const initial=await body.evaluate((node:HTMLTextAreaElement)=>({start:node.selectionStart,end:node.selectionEnd,scroll:node.scrollTop}));
  for (const width of [999,1000,699,700,999,1000,1440,1000]) {
    await page.setViewportSize({width,height:768});
    await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode',width<700?'drawer':'column');
    await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode',width<1000?'drawer':'column');
    expect(await body.evaluate((node,original)=>node===original,handle)).toBe(true);
    await expect(body).toHaveValue(written);
    await expect(body).toBeFocused();
    expect(await body.evaluate((node:HTMLTextAreaElement)=>[node.selectionStart,node.selectionEnd,node.scrollTop])).toEqual([initial.start,initial.end,initial.scroll]);
    await expect(page.getByRole('textbox',{name:'Borrador técnico'})).toHaveCount(1);
  }
  await body.focus();await page.keyboard.press('ControlOrMeta+Z');
  await expect(body).not.toHaveValue(written);
  await expect(page.getByRole('button',{name:'Tiempo de ensayo'})).toHaveAttribute('aria-expanded','true');
  await expect(estimate).toHaveValue('abc');
  // Independent temporal undo: it is now the last native edit, so historyUndo must affect it.
  await estimate.fill('ab');await estimate.focus();await page.keyboard.type('c');
  await expect(estimate).toHaveValue('abc');
  await page.setViewportSize({width:999,height:768});
  await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode','column');
  await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode','drawer');
  await expect(page.getByRole('button',{name:'Mostrar Tiempo'})).toBeFocused();
  await page.setViewportSize({width:1000,height:768});
  await expect(page.locator('#navigation-panel')).toHaveAttribute('data-panel-mode','column');
  await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode','column');
  await estimate.focus();await page.keyboard.press('ControlOrMeta+Z');
  await expect(estimate).toHaveValue('ab');
});

test('3A technical slots · EXTRA-NATIVE-EDIT · composición emulada no guarda; API fullscreen ausente y denegada separadas',async ({page}) => {
  await page.setViewportSize({width:1000,height:768});await page.goto(technical);
  const title=page.getByRole('textbox',{name:'Título técnico'});
  await title.dispatchEvent('compositionstart');await title.dispatchEvent('keydown',{key:'Enter',isComposing:true,keyCode:229});await title.dispatchEvent('compositionend');
  await expect(page.getByLabel('Guardados técnicos')).toHaveText('0');
  await title.press('Enter');await expect(page.getByLabel('Guardados técnicos')).toHaveText('1');
  const body=page.getByRole('textbox',{name:'Borrador técnico'});const raw=await body.inputValue();
  await page.evaluate(()=>Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:undefined}));
  await page.getByRole('button',{name:'Pantalla completa de ensayo'}).click();
  await expect(page.getByRole('status', {name: 'Estado de pantalla completa'})).toHaveText('Pantalla completa no está disponible. Puedes seguir trabajando.');
  await expect(body).toHaveValue(raw);
  await page.evaluate(()=>Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}));
  await page.getByRole('button',{name:'Pantalla completa de ensayo'}).click();
  await expect(page.getByRole('status', {name: 'Estado de pantalla completa'})).toHaveText('No se pudo abrir pantalla completa. Puedes seguir trabajando.');
  await expect(body).toHaveValue(raw);
});

test('3A technical slots · EXTRA-NATIVE-EDIT · fullscreen REAL cambia API y conserva instancia/edit/raw al salir',async ({page})=>{
  await page.setViewportSize({width:1000,height:768});await page.goto(technical);
  const body=page.getByRole('textbox',{name:'Borrador técnico'});const handle=await body.elementHandle();const raw=await body.inputValue();
  await page.getByRole('button',{name:'Pantalla completa de ensayo'}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement!==null)).toBe(true);
  await page.getByRole('button',{name:'Pantalla completa de ensayo'}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await expect(body).toHaveValue(raw);expect(await body.evaluate((node,original)=>node===original,handle)).toBe(true);
});


test('3A technical slots · EXTRA-NATIVE-EDIT · preferencia hidden mantiene drawer abierto al ampliar',async ({page})=>{
  await page.setViewportSize({width:1000,height:768});await page.goto(technical);
  await page.getByRole('button',{name:'Ocultar Tiempo'}).click();
  await expect(page.locator('#time-panel')).toBeHidden();
  await page.setViewportSize({width:999,height:768});
  await page.getByRole('button',{name:'Mostrar Tiempo'}).click();
  const estimate=page.getByRole('textbox',{name:'Estimación técnica'});await estimate.fill('abc');
  const handle=await estimate.elementHandle();
  await page.setViewportSize({width:1000,height:768});
  await expect(page.locator('#time-panel')).toHaveAttribute('data-panel-mode','drawer');
  await expect(estimate).toHaveValue('abc');expect(await estimate.evaluate((node,original)=>node===original,handle)).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#time-panel')).toBeHidden();
  await expect(page.getByRole('button',{name:'Mostrar Tiempo'})).toBeFocused();
});
