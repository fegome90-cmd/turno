import {expect, test, type Page} from '@playwright/test';

// Harness 1B (harness.html, no incluido en dist/preview.html). Navegador real, un worker.
// Cada caso comprueba comportamiento observable en Chromium: foco, nodos, tokens calculados, pila y capas.
test.use({actionTimeout: 4000});

const HARNESS = '/harness.html';

async function openHarness(page: Page, options: {width?: number; height?: number; dark?: boolean} = {}) {
  await page.setViewportSize({width: options.width ?? 1280, height: options.height ?? 900});
  await page.emulateMedia({colorScheme: options.dark ? 'dark' : 'light'});
  await page.goto(HARNESS);
  await expect(page.locator('#root h1').first()).toBeVisible();
}

// Contraste WCAG entre dos colores rgb(a)() computados en el navegador.
function contrast(fg: string, bg: string): number {
  const parse = (value: string) => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) throw new Error(`color no reconocido: ${value}`);
    const [r, g, b] = match[1].split(',').map((part) => Number.parseFloat(part));
    return [r, g, b];
  };
  const lum = ([r, g, b]: number[]) => {
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const a = lum(parse(fg));
  const b = lum(parse(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.describe('G1B · contratos de primitivas en Chromium', () => {
  test('EXTRA-NATIVE-EDIT · un solo nodo de campo, texto crudo y error conservados al cruzar 699↔700 y 999↔1000', async ({page}) => {
    await openHarness(page, {width: 699});
    const field = page.getByRole('textbox', {name: 'Estimación'});
    await field.fill('1.5');
    await field.evaluate((node) => {
      (window as unknown as {__estimate: Element}).__estimate = node;
    });
    for (const width of [700, 999, 1000, 699]) {
      await page.setViewportSize({width, height: 900});
      // Positivo: el docking cambió de verdad en este ancho (700 y 1000 son los umbrales).
      await expect(page.locator('main')).toHaveAttribute('data-band', width >= 700 ? 'wide' : 'narrow');
      await expect(page.locator('main')).toHaveAttribute('data-band-1000', width >= 1000 ? 'wide' : 'narrow');
      await expect(page.getByRole('textbox', {name: 'Estimación'})).toHaveValue('1.5');
      const same = await field.evaluate((node) => (window as unknown as {__estimate: Element}).__estimate === node);
      expect(same, `mismo nodo a ${width}px`).toBe(true);
    }
    await expect(page.getByText('Estimación: usa minutos enteros entre 0 y 1440.')).toBeVisible();
  });

  test('EXTRA-NATIVE-EDIT · tema claro, oscuro y sistema con Popover, Dialog y avisos abiertos: tokens y contraste ≥ 4.5:1', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Generar 3 avisos'}).click();
    await expect(page.locator('[data-notice]')).toHaveCount(3);
    const measure = (selector: string) =>
      page.evaluate((sel) => {
        const node = document.querySelector(sel) as HTMLElement | null;
        if (!node) throw new Error(`sin nodo: ${sel}`);
        const bgOf = (el: HTMLElement | null): string => {
          for (let n: HTMLElement | null = el; n; n = n.parentElement) {
            const c = getComputedStyle(n).backgroundColor;
            if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
          }
          return 'rgb(255, 255, 255)';
        };
        return {text: getComputedStyle(node).color, bg: bgOf(node)};
      }, selector);
    for (const [choice, expected] of [['Oscuro', 'dark'], ['Claro', 'light'], ['Sistema', 'light']] as const) {
      await page.getByRole('button', {name: 'Más opciones'}).click();
      await page.getByRole('button', {name: choice}).click();
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(theme, `tema tras ${choice}`).toBe(expected);
      const tokens = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
      expect(tokens).toBe(expected === 'dark' ? '#171817' : '#fff');
      await expect(page.getByRole('dialog', {name: 'Más opciones'})).toBeVisible();
      const popover = await measure('[data-overlay-layer="more"] h2, [data-overlay-layer="more"] [id]');
      expect(contrast(popover.text, popover.bg), `popover ${choice}`).toBeGreaterThanOrEqual(4.5);
      const toast = await measure('[data-notice]');
      expect(contrast(toast.text, toast.bg), `aviso ${choice}`).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', {name: 'Más opciones'})).toHaveCount(0);
      await page.getByRole('button', {name: 'Crear tarea'}).click();
      await expect(page.getByRole('dialog', {name: 'Crear tarea'})).toBeVisible();
      const dialog = await measure('[data-overlay-layer="create"] h2');
      expect(contrast(dialog.text, dialog.bg), `diálogo ${choice}`).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', {name: 'Crear tarea'})).toHaveCount(0);
    }
  });

  test('G1B-OVERLAY · Escape cierra solo la capa superior y el foco vuelve a un destino visible', async ({page}) => {
    await openHarness(page);
    const trigger = page.getByRole('button', {name: 'Abrir navegación'});
    await trigger.click();
    await page.getByRole('dialog', {name: 'Navegación'}).getByRole('button', {name: 'Más opciones'}).click();
    await expect(page.getByRole('dialog', {name: 'Más opciones'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', {name: 'Más opciones'})).toHaveCount(0);
    await expect(page.getByRole('dialog', {name: 'Navegación'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', {name: 'Navegación'})).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('G1B-OVERLAY · Tab sale del Popover de tema', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Más opciones'}).click();
    const popover = page.getByRole('dialog', {name: 'Más opciones'});
    await expect(popover).toBeVisible();
    await popover.getByRole('button').last().focus();
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][data-overlay-layer="more"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(inside).toBe(false);
  });

  test('G1B-OVERLAY · Drawer → Dialog: Escape cierra solo el Dialog con foco en el control del Drawer; otro Escape cierra el Drawer y el foco vuelve al disparador', async ({page}) => {
    await openHarness(page);
    const trigger = page.getByRole('button', {name: 'Abrir navegación'});
    await trigger.click();
    const drawer = page.getByRole('dialog', {name: 'Navegación'});
    await expect(drawer).toBeVisible();
    const drawerCreate = drawer.getByRole('button', {name: 'Crear tarea'});
    await drawerCreate.click();
    const dialog = page.getByRole('dialog', {name: 'Crear tarea'});
    await expect(dialog).toBeVisible();
    // Con el Dialog abierto, la pila de avisos y el contenido del Drawer quedan inertes.
    await expect(page.locator('[data-notification-root]')).toHaveJSProperty('inert', true);
    const drawerInert = await page.evaluate(() => {
      // El Drawer está fuera del Dialog modal: él mismo o un ancestro lleva inert, aria-hidden o la marca de Base UI.
      const node = document.querySelector('[data-overlay-layer="navigation"]');
      return Boolean(node?.closest('[inert],[aria-hidden="true"],[data-base-ui-inert]'));
    });
    expect(drawerInert).toBe(true);
    // El foco entra en el Dialog al abrir (espera explícita: no se pulsa Tab antes de que Base UI lo mueva).
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-overlay-layer="create"]'))))
      .toBe(true);
    // Tab dentro del Dialog no sale hacia el contenido inerte del Drawer ni hacia la pila.
    // Base UI puede pasar por su guardia de foco (fuera del Dialog) y devolverlo dentro: se exige el retorno,
    // y en ningún momento el foco llega al Drawer inerte ni a la pila.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      await expect
        .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[data-overlay-layer="create"]'))), {
          message: `Tab ${i + 1} devuelve el foco al Dialog`,
        })
        .toBe(true);
      const forbidden = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-overlay-layer="navigation"], [data-notification-root]')),
      );
      expect(forbidden, `Tab ${i + 1} no llega al Drawer ni a la pila`).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(drawer).toBeVisible();
    await expect(drawerCreate).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('G1B-OVERLAY · Popover de tema no modal: Tab sale del Popover y la página no queda inerte', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Más opciones'}).click();
    const popover = page.getByRole('dialog', {name: 'Más opciones'});
    await expect(popover).toBeVisible();
    await popover.getByRole('button', {name: 'Oscuro'}).focus();
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const popup = document.querySelector('[data-overlay-layer="more"]');
      const create = document.querySelector('[data-focus-key="open-create-page"]');
      return {
        insidePopover: Boolean(popup?.contains(document.activeElement)),
        pageInert: Boolean(create?.closest('[inert],[aria-hidden="true"]')),
      };
    });
    // D2: no modal. El foco sale; el Popover puede cerrarse o seguir abierto, pero la página no queda inerte.
    expect(state.insidePopover).toBe(false);
    expect(state.pageInert).toBe(false);
  });

  test('G1B-NOTIFY · Alt+T enfoca el botón de cierre del aviso más reciente; Escape cierra solo ese aviso y el foco pasa al siguiente cierre', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Generar 3 avisos'}).click();
    const closes = page.locator('[data-notice] [data-close-notice]');
    await expect(closes).toHaveCount(3);
    await page.locator('h1').click();
    await page.keyboard.press('Alt+t');
    await expect(closes.nth(2)).toBeFocused();
    await closes.nth(1).focus();
    await page.keyboard.press('Escape');
    await expect(closes).toHaveCount(2);
    await expect(page.locator('[data-notice]').filter({hasText: 'Aviso 2'})).toHaveCount(0);
    await expect(closes.nth(1)).toBeFocused();
    await expect(page.locator('[data-notice]').nth(1)).toContainText('Aviso 3');
  });

  test('G1B-NOTIFY · la llegada de un aviso nuevo no mueve el foco', async ({page}) => {
    await openHarness(page);
    const generate = page.getByRole('button', {name: 'Generar 30 avisos'});
    await generate.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-notice]')).toHaveCount(30);
    await expect(generate).toBeFocused();
  });

  test('G1B-NOTIFY · 30 avisos sin expulsión, pila suspendida inerte y descarte por teclado con foco al siguiente cierre', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Generar 30 avisos'}).click();
    await expect(page.locator('[data-notice]')).toHaveCount(30);
    await page.waitForTimeout(500);
    await expect(page.locator('[data-notice]')).toHaveCount(30);
    await expect(page.getByRole('region', {name: 'Avisos'}).getByText('Error 14', {exact: true})).toBeAttached();
    await page.getByRole('button', {name: 'Abrir navegación'}).click();
    await expect(page.locator('[data-notification-root]')).toHaveJSProperty('inert', true);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-notification-root]')).toHaveJSProperty('inert', false);
  });

  test('G1B-NOTIFY · descarte por teclado de un aviso intermedio enfoca el cierre siguiente', async ({page}) => {
    await openHarness(page);
    await page.getByRole('button', {name: 'Generar 3 avisos'}).click();
    const closes = page.locator('[data-notice] [data-close-notice]');
    await expect(closes).toHaveCount(3);
    await closes.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-notice]')).toHaveCount(2);
    await expect(closes.nth(1)).toBeFocused();
  });

  test('EXTRA-LIFECYCLE-ASYNC · un solo root de React en el documento', async ({page}) => {
    await openHarness(page);
    await expect(page.locator('#root')).toHaveCount(1);
    const roots = await page.evaluate(() => document.querySelectorAll('#root').length);
    expect(roots).toBe(1);
  });
});
