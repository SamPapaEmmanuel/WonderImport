'use client';

import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { THEME_DESCRIPTION, THEME_LABEL, THEME_ORDER } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui-store';

/** Appearance preference: follow the device, or force light/dark. Mirrors the top-bar toggle. */
export function AppearancePanel() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <Panel>
      <PanelHeader title="Appearance" description="Light and dark themes share the same layout. System follows your device." />
      <PanelBody>
        <div role="radiogroup" aria-label="Appearance" className="flex flex-col gap-2">
          {THEME_ORDER.map((t) => {
            const selected = theme === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(t)}
                className={cn(
                  'flex items-center gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors',
                  selected ? 'border-fjord bg-glacier' : 'border-line hover:border-tide',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-4 flex-none place-items-center rounded-full border',
                    selected ? 'border-fjord' : 'border-line',
                  )}
                >
                  {selected && <span className="size-2 rounded-full bg-fjord" />}
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium">{THEME_LABEL[t]}</span>
                  <span className="block text-[12.5px] text-ink-3">{THEME_DESCRIPTION[t]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}
