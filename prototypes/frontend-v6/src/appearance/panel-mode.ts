export type PanelMode = {navigation: 'column' | 'drawer'; time: 'column' | 'drawer'};

// Geometry only. Home and the explicit hidden-inspector preference are applied by AppShell.
export function getPanelMode(width: number): PanelMode {
  return {navigation: width >= 700 ? 'column' : 'drawer', time: width >= 1000 ? 'column' : 'drawer'};
}
