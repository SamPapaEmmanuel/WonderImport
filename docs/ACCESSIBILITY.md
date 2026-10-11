# Accessibility review

Target: WCAG 2.1 level AA for every screen, in light and dark themes, on desktop and phone.

## Fixed in this release

- **Text contrast.** Measured every text colour against every background it appears on. Five failed in light mode and six in dark mode (grey hints at 2.9:1, green profit figures, amber warnings, links, and white text on the dark-mode primary button at 2.8:1). Each was replaced by the nearest shade of the same hue that reaches at least 4.6:1 everywhere. Status dots and route lines keep their original hues; they are graphics and are always paired with text.
- **Keyboard access to table rows.** Rows that open a record (goods, clients, imports) are now focusable and open with Enter or Space. Buttons and checkboxes inside a row keep their own keys.
- **Honest widget roles.** Two segmented controls claimed to be tabs without the full tab behaviour; they are now pressed-button groups, which screen readers describe correctly.

## Already in place

- Skip link to the main content; page language set; one `h1` per screen.
- Every form control has a visible label; errors are linked with `aria-describedby` and flagged with `aria-invalid`; error summaries use `role="alert"`.
- Dialogs and drawers use the native `<dialog>` element (focus is held inside, Escape closes, the page behind is inert).
- Menus open from buttons, support arrow keys and Escape, and return focus to their button.
- Status is always a dot **and** a word; manual prices show an "M" marker with a text explanation.
- Toggle groups report their state with `aria-pressed`; sortable columns report `aria-sort`.
- Toasts are announced through a polite live region; errors use `role="alert"`.
- Visible focus outline on every interactive element; motion is removed when the user prefers reduced motion.
- Layouts reflow to a single column on phones; wide tables scroll inside their own panel.

## Automated checks

`frontend/e2e/a11y.spec.ts` runs axe (WCAG 2.0/2.1 A and AA rules) on Dashboard, Goods, Clients, Imports, Reports, Settings and Sign in, in light and dark themes, on desktop and on a phone viewport. Any serious or critical violation fails. It also checks the skip link, opening a row with the keyboard, and closing the drawer with Escape.

## Known limitations

- Toasts that appear while a dialog is open are outside the dialog, so screen readers may not announce them until it closes. The dialog itself also shows the outcome of every action, so no information is lost.
- The shipping route is a horizontal diagram. On narrow screens it scrolls sideways; each station is still a labelled link with its count.
- Automated tools find roughly a third of issues. Before release, do one manual pass with a screen reader (NVDA or VoiceOver) through: sign in, add a good, move it a stage, import a file, export.
