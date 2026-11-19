---
name: Yoread
description: Chrome popup for translating the current page.
colors:
  surface: "#fff"
  panel: "#f6f7f9"
  ink: "#20242c"
  muted: "#59616f"
  rule: "#e0e3e9"
  field-rule: "#808897"
  accent: "#c34200"
  accent-hover: "#a73600"
  accent-active: "#872d00"
  accent-soft: "#fff3e9"
  success: "#176445"
  success-soft: "#eaf5ee"
  danger: "#a52b36"
typography:
  display:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "19px"
    fontWeight: 730
    lineHeight: 1.15
    letterSpacing: "-.025em"
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
  mark-corner: "2px"
  mark-fold: "4px"
  control: "8px"
  brand-mark: "10px"
  mark-corner: "2px"
  mark-fold: "4px"
  panel: "12px"
  pill: "20px"
spacing:
  row-gap: "8px"
  panel-inset: "12px"
  popup-inset: "20px"
  narrow-inset: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "38px"
  button-secondary-hover:
    textColor: "{colors.accent}"
  button-secondary-active:
    backgroundColor: "{colors.accent-soft}"
  input-key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    height: "38px"
  button-restore:
    backgroundColor: transparent
    textColor: "{colors.ink}"
  language-route:
    textColor: "{colors.muted}"
  panel-consent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-inset}"
  settings-state:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  settings-state-configured:
    backgroundColor: "{colors.success-soft}"
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

Yoread is a compact desktop Chrome utility. Alibaba Fusion informs the clear control hierarchy. The white workspace leads with page status and actions. A single disclosure groups DeepSeek and GitHub configuration. Warm orange marks the primary action and the translation destination.

## Colors

Use white for the workspace and collapsed settings, and light gray when settings are expanded. Ink carries titles and actions, muted carries status and hints, and divider rules separate rows. The darker field rule outlines inputs and secondary buttons. Use orange for the primary action, active updates, and consent. Green indicates configured, restored, or completed states. Red marks errors and incomplete translations.

## Typography

Use one system sans-serif stack for the wordmark and Chinese interface. The wordmark is 19px. Controls and body copy use 14px. The language route, page status, and settings labels use 12px. Progress counts use tabular figures.

## Layout

The popup is 400px wide and capped at the viewport width. Horizontal padding drops from 20px to 16px at viewport widths of 340px or less. Place the inline language route on the right of the masthead. Below it, put page status and actions before the single settings disclosure. The translate and restore actions have a 3:2 width ratio, and the confirmation actions have equal widths. Use an 8px gap within action rows.

## Elevation & Depth

A thin rule separates the workspace from settings. The settings area gains a light gray fill when expanded. The consent panel uses a pale orange fill.

## Shapes

Use 8px corners on buttons and the password field, 12px on the consent panel, and 20px on the configuration badge and switch track. The masthead mark is a 28px square with 10px corners. Its two outline strokes use 2px corners and 4px folds.

## Components

### Actions and status

Pair a filled translation button with a transparent restore button. Main controls are at least 38px high. Connection testing and key clearing use 36px controls. Disabled buttons use muted text. Filled and outlined controls also gain a light gray fill when disabled. The status names progress, success, or a retryable issue. The 6px progress bar appears while translation runs.

### Language route and send confirmation

Show the source and destination inline in the masthead, with an arrow between them. On the first translation request for a page, replace the normal action row with the inline consent panel. Name DeepSeek as the recipient and make the current-page scope visible. Move keyboard focus to confirmation and restore it to the available page action or status after dismissal.

### Settings disclosure and switch

Use a native details disclosure with a right-aligned chevron. Show the API Key configuration state in the disclosure row and open settings initially when the key is missing. Place a labeled password field and the GitHub interface translation switch inside the same disclosure, on separate rows. Focus uses a visible 2px dark orange outline with a 3px offset. The switch transition respects reduced-motion preferences.
