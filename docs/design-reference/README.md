# Design reference: Finders Eaters V0.1

Round 1 output from Claude Design, built from `docs/design-handoff/BRIEF.md`: the design system and the three hardest components. Screens follow in later rounds.

| File | What it is |
|---|---|
| `tokens.css` | Design tokens as CSS custom properties: colour roles (light, dark via `prefers-color-scheme`), type, spacing, radius, elevation, motion, touch targets |
| `components/design-system.dc.html` | Component sheet. Open in a browser (needs `support.js` beside it and a connection for Google Fonts) |

## Decisions

- **Identity**: warm paper background, ink text, one rosemary-green accent (`#2F5D46` light, `#8CC4A2` dark). Butter yellow (`color.highlight`) is reserved for the uncertain span in original recipe text.
- **Type**: Atkinson Hyperlegible Next for all UI text; Newsreader for screen and sheet titles only. Body 17 px, minimum 13 px (caps labels, badges). Amounts use tabular figures.
- **Contrast**: every text pair is WCAG 2.2 AA or better in both themes. Dark theme drops shadows in favour of raised surface plus a 1 px border.
- **Shopping row**: 64 px minimum, whole row is the target, tick circle on the left, amount right-aligned. Ticked rows strike through and fade to 55% for 1.3 s, then move to In the basket. "was N" uses the warning colours, "serve with" the accent-subtle; both are words, so colour is never the only signal.
- **Suggestions vs plan items**: plan items are solid surface cards; suggestions have no fill, a 1.5 px dashed strong border, and sit under a "Suggested · Not in the plan until added" heading. Distinguishable in greyscale.
- **Another (replaced in place)**: card keeps its position, fills with accent-subtle and shows "New pick" for 2 s. Reasons that refresh without a new recipe only cross-fade text. Reduced motion: no fade; "New pick" stays until the next change.
- **Why this?**: signed bars around a centre line, "Against" left, "For" right, label aligned to its side. No numbers.
- **Review densities**: check card is raised with a strong border, the question as heading, original text in a sunken well with the uncertain span highlighted and wavy-underlined, answers as stacked full-width 48 px buttons plus Edit. Glance line is a flat row with original over reading and a 44 px round tick. Clear line is muted original text only. Done line shows a "Checked" badge.

## Suggestions on the brief

- "Looks right - confirm N" reads better as "Confirm N"; the hyphen looks like a typo on a button.

## Still open (next rounds)

- Recipes and Shopping screens at 390 x 844, then the rest of section 6.
- Section 9: how a first-time user learns the exclude tap, sample-check entry point, pool-running-out as toast or inline, whether Always have gets its own screen.
- `tokens.json` (W3C format) can be generated from `tokens.css` if the build prefers it.
