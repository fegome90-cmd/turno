// Tema de sesión (D1): sin storage, sin red. Preferencia por defecto «system».
// data-theme y data-theme-preference en <html>; el script inline de preview.html fija el primer paint.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export type ThemeApi = {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference(value: ThemePreference): boolean;
};

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readMedia(): MediaQueryList | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(DARK_QUERY) ?? null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({children}: {children: ReactNode}) {
  const [media] = useState<MediaQueryList | null>(readMedia);
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState<boolean>(() => media?.matches === true);

  useEffect(() => {
    if (!media) return undefined;
    const onChange = () => setSystemDark(media.matches === true);
    onChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener?.(onChange);
    return () => media.removeListener?.(onChange);
  }, [media]);

  const effective: EffectiveTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effective;
    root.dataset.themePreference = preference;
  }, [effective, preference]);

  const setPreference = useCallback((value: ThemePreference): boolean => {
    if (!PREFERENCES.includes(value)) return false;
    setPreferenceState(value);
    return true;
  }, []);

  const api = useMemo<ThemeApi>(
    () => ({preference, effective, setPreference}),
    [preference, effective, setPreference],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);
  if (!api) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return api;
}
