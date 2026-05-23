---
name: design-enterprise
version: 0.1.0
description: LabelHub enterprise console UI rules.
---

# LabelHub Enterprise Design Skill

Use a high-trust data production console style.

## Tokens

- primary: `#072C2C`
- accent: `#FF5F03`
- success: `#16A34A`
- warning: `#D97706`
- danger: `#DC2626`
- surface: `#EDEADE`
- text: `#111827`

## Layout

- All pages use `AppShell`: top bar, 240px left nav, main workspace, optional 360px right AgentPanel.
- AI suggestions live in AgentPanel or inline suggestion cards.
- Data-heavy pages prefer tables, cards, filters, status tags and audit logs.

## Accessibility

- All interactive elements must have visible focus states.
- Status cannot be represented by color alone.
- Hit targets should be at least 40px tall.
