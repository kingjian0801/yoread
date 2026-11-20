---
name: Yoread
description: A compact, book-inspired Chrome popup for translating the current page.
colors:
  surface: "#fff"
  panel: "#f8f6f2"
  ink: "#2d2b28"
  muted: "#6a635b"
  rule: "#e5dfd7"
  field-rule: "#90877e"
  accent: "#b14520"
  accent-hover: "#903514"
  accent-active: "#73290f"
  accent-soft: "#faeee2"
  success: "#176445"
  danger: "#a52b36"
  bookmark: "#cf8766"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-.035em"
  language-route:
    fontFamily: '"Songti SC", STSong, "Noto Serif CJK SC", serif'
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.45
  headline:
    fontSize: "14px"
    lineHeight: 1.35
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontSize: "12px"
rounded:
  control: "10px"
  sheet: "13px"
  pill: "20px"
spacing:
  row-gap: "8px"
  popup-inset: "16px"
  narrow-inset: "12px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "40px"
  button-secondary-hover:
    textColor: "{colors.accent}"
  button-secondary-active:
    backgroundColor: "{colors.accent-soft}"
  input-key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    height: "40px"
  button-restore:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
  language-route:
    typography: "{typography.language-route}"
    textColor: "{colors.ink}"
  route-sheet:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "15px 16px 13px"
  panel-consent:
    padding: "12px 0 0"
  settings-state:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  settings-state-configured:
    textColor: "{colors.success}"
  switch:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "26px"
  switch-checked:
    backgroundColor: "{colors.accent}"
---

# Design System for Yoread

## Overview

**Creative North Star** — The bookmarked page

Yoread borrows the open-book mark, serif lettering and bookmark of a printed book for a short browser task. The language route takes the largest type in the workspace. A reader can check the current page’s status directly beneath it and reach the translation action in the next row.

- The masthead pairs Yoread with its translation provider.
- One warm paper sheet groups the language route, status and progress.
- The bottom disclosure keeps configuration within reach.

## Colors

Terracotta marks the book outline, direction arrow, primary action and working or confirmation status. Its darker shades distinguish hover, pressed and keyboard focus. The pale peach sheet carries a muted copper bookmark. Ink and warm gray keep language names distinct from status and provider text.

The workspace is white. The restore button and settings share a warm off-white fill. A light rule divides settings from the workspace, while a darker rule outlines editable fields and secondary actions. Green accompanies success or a configured key. Red accompanies an error or incomplete result.

## Typography

The Yoread wordmark uses Georgia with a tight line height. The language names use a Chinese serif stack with a taller line box so the arrow aligns with the characters. The provider, actions, status, hints and settings use the system sans-serif stack. Controls use a 650 weight, supporting text uses 12px, and page status uses tabular figures for changing counts.

## Layout

The popup is 360px wide, capped at the viewport width. The masthead, translation area and settings share 16px side insets. The provider sits at the trailing edge of the masthead. The language route wraps between whole labels. At 300px and below, side insets shrink to 12px and the route uses 18px type with an 8px gap.

The page actions sit 10px below the sheet. Translate and restore divide the row in a 3:2 ratio with an 8px gap. The inline consent form takes their place when confirmation is required and gives its two buttons equal width.

## Elevation & Depth

Flat fills distinguish the sheet and settings from the white workspace. A single horizontal rule marks the beginning of settings in both its open and closed states.

## Shapes

The open-book mark uses two skewed page outlines inside a 25 × 21px area. A 10 × 17px notched ribbon hangs from the sheet’s top right edge. The sheet has 13px corners, buttons and the password field have 10px corners, and the switch has a rounded track.

## Components

### Language route and page status

Place the source and destination on either side of a terracotta arrow. Keep the status directly under the route. While translation runs, show a 6px progress bar below the status.

### Actions and confirmation

The filled button translates or confirms sending the current page’s text to DeepSeek. Restore uses a soft fill, including in its disabled state. Cancel and key-management actions use outlines. Main buttons are at least 40px tall. Connection testing and key clearing use 36px controls. Consent copy names the recipient and the current-page scope before the confirmation button.

### Settings disclosure and switch

The 42px-minimum summary row contains a sliders icon, the settings label, key state and chevron. A configured key has a small green dot and a text label. The single disclosure opens initially when the key is missing. Inside, the labeled password field and save button share a row. Below the key controls, a rule introduces the independent GitHub local interface translation switch.

Keyboard focus uses a 2px dark terracotta outline with a 3px offset. Button colors and the disclosure chevron respond over 140ms, while the switch thumb moves over 160ms. Reduced motion removes these transitions.
