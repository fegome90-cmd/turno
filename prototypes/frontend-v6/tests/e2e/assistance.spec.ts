import {test, expect} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const product=pathToFileURL(resolve('dist/preview.html')).href;

test('captura literal: fecha obligatoria, revisión y sugerencias por tareas reales',async({page,context})=>{
  await page.setViewportSize({width:1440,height:900});
  const external:string[]=[];
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(/^(file:|data:|blob:)/.test(url)) return route.continue();
    external.push(url);return route.abort();
  });
  await page.goto(product);
  await page.getByRole('button',{name:'Abrir captura de tareas'}).click();
  const dialog=page.getByRole('dialog',{name:'Captura y sugerencias'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox',{name:'Tareas para revisar'}).fill('Revisar tarea pendiente A\nRevisar tarea pendiente B');
  await dialog.getByRole('button',{name:'Pasar a revisión'}).click();
  const first=dialog.locator('fieldset.assist-review-card').first();
  await expect(dialog.locator('fieldset.assist-review-card')).toHaveCount(2);
  await first.getByRole('combobox',{name:'Lista'}).selectOption('bed-1');
  await first.getByLabel('Hora',{exact:true}).fill('15:00');
  await first.getByRole('button',{name:'Aprobar y guardar'}).click();
  await expect(first.getByRole('alert')).toContainText('Confirma una fecha');
  await first.getByLabel('Fecha',{exact:true}).fill('2026-11-07');
  await first.getByRole('button',{name:'Aprobar y guardar'}).click();
  await expect(dialog.locator('fieldset.assist-review-card')).toHaveCount(1);
  const second=dialog.locator('fieldset.assist-review-card').first();
  await second.getByRole('combobox',{name:'Lista'}).selectOption('bed-1');
  await second.getByLabel('Fecha',{exact:true}).fill('2026-11-07');
  await second.getByLabel('Hora',{exact:true}).fill('15:00');
  await second.getByRole('button',{name:'Aprobar y guardar'}).click();
  await expect(dialog.locator('fieldset.assist-review-card')).toHaveCount(0);
  await dialog.getByRole('tab',{name:/Sugerencias/}).click();
  await expect(dialog.getByText('Tareas en el mismo horario')).toBeVisible();
  await expect(dialog.getByText(/no demuestra duplicidad/)).toBeVisible();
  await dialog.getByRole('button',{name:'Revisar tarea'}).click();
  await expect(page.getByRole('textbox',{name:'Título de tarea'})).toHaveValue(/Revisar tarea pendiente/);
  expect(external).toEqual([]);
});

test('móvil: cierre con borradores conserva datos y permite descarte explícito',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(product);
  await page.getByRole('button',{name:'Abrir captura de tareas'}).click();
  const dialog=page.getByRole('dialog',{name:'Captura y sugerencias'});
  await dialog.getByRole('textbox',{name:'Tareas para revisar'}).fill('Completar informe');
  await dialog.getByRole('button',{name:'Cerrar captura y sugerencias'}).click();
  await expect(dialog.getByText('Hay texto o tareas sin guardar. ¿Quieres descartarlos y cerrar?')).toBeVisible();
  await dialog.getByRole('button',{name:'Seguir revisando'}).click();
  await expect(dialog.getByRole('textbox',{name:'Tareas para revisar'})).toHaveValue('Completar informe');
  await dialog.getByRole('button',{name:'Pasar a revisión'}).click();
  const card=dialog.locator('fieldset.assist-review-card').first();
  await card.getByRole('checkbox',{name:/Antes del cierre/}).check();
  await card.getByRole('button',{name:'Aprobar y guardar'}).click();
  await expect(card).toHaveCount(0);
  await dialog.getByRole('tab',{name:/Sugerencias/}).click();
  await expect(dialog.getByText('Pendientes antes del cierre')).toBeVisible();
  await dialog.getByRole('button',{name:'Cerrar captura y sugerencias'}).click();
  await expect(dialog).not.toBeVisible();
});
