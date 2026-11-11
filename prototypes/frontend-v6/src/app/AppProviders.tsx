import type {ReactNode} from 'react';
import {ThemeProvider} from '../appearance/theme-provider';

export function AppProviders({children}: {children: ReactNode}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
