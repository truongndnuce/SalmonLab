import vi from '../messages/vi.json';

export type MessageKey = keyof typeof vi;

/**
 * Looks up a UI string and fills `{name}` placeholders. Only Vietnamese exists today; keeping strings in
 * messages/<locale>.json means adding a language later is a new file plus a locale switch here.
 */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return vi[key].replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
