import type { ResolvedTheme, ThemePreference } from '@/types'

export const THEME_STORAGE_KEY = 'oj-tema'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/**
 * Script inline injetado no <head> (app/layout.tsx). Roda antes do React hidratar
 * para aplicar a classe .dark já na primeira pintura — sem "flash" de tema claro.
 * Precisa ser autocontido (não pode importar nada) e espelhar resolveTheme().
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem('${THEME_STORAGE_KEY}');
if(p!=='light'&&p!=='dark')p='system';
var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
}catch(e){}})();`
