import {describe, expect, it} from 'vitest';
import {getPanelMode} from '../../src/appearance/panel-mode';

// Replacing either independent boundary with the other would fail these cases.
describe('3A · límites independientes de panel', () => {
  it.each([
    [320, 'drawer', 'drawer'], [390, 'drawer', 'drawer'], [699, 'drawer', 'drawer'],
    [700, 'column', 'drawer'], [999, 'column', 'drawer'], [1000, 'column', 'column'],
    [1024, 'column', 'column'], [1440, 'column', 'column'],
  ] as const)('%i: navegación %s y Tiempo %s', (width, navigation, time) => {
    expect(getPanelMode(width)).toEqual({navigation, time});
  });
});
