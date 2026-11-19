---
name: Yoread
description: Compact Chrome popup for translating the current page.
colors:
  teal: "#135f53"
  teal-hover: "#0d4c42"
  teal-soft: "#e7efe7"
  paper: "#f3f8f6"
  soft: "#e4efe9"
  ink: "#1b2825"
  muted: "#455c53"
  rule: "#b8cbc2"
  field-rule: "#6f897d"
  field: "#fcfffd"
  white: "#fff"
  warning: "#842935"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.03em"
  headline:
    fontSize: "18px"
    lineHeight: 1.3
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontSize: "12px"
rounded:
  control: "8px"
  panel: "14px"
  switch: "20px"
spacing:
  row-gap: "8px"
  panel-inset: "12px"
  popup-inset: "24px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.teal-hover}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.teal-soft}"
  input-key:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  panel-consent:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.control}"
    padding: "{spacing.panel-inset}"
  switch:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.switch}"
    width: "44px"
    height: "26px"
  switch-checked:
    backgroundColor: "{colors.teal}"
---

# Design System for Yoread

## Overview

Yoread is a compact editorial utility for desktop Chrome. The serif wordmark and mineral greens establish the identity, while short status text and paired actions keep the current page in focus.

## Colors

Mineral green marks the wordmark, primary actions, and keyboard focus. Deep green marks primary hover and successful outcomes. Pale green distinguishes hovered secondary actions and selected text. Denser pale green sets the consent panel and unchecked switch apart from the paper background.

Use ink for labels and body copy and muted green for hints and configuration state. Divider rules organize sections, and the darker field border identifies the password input. Warning text uses burgundy with a message that describes the problem.

## Typography

Georgia anchors the wordmark at 38px. A system font stack led by PingFang SC and Microsoft YaHei carries the Simplified Chinese UI at 14px. The current-page heading is 18px, and hints, feedback, and setting states are 12px. Controls and disclosure labels use weight 600.

## Layout

The popup is a single column, 460px wide with a viewport cap and 24px of padding. At 340px and below, use 16px outer padding. The header pairs the wordmark with the language direction. In the current-page panel, status and progress precede the translate and restore row. Consent takes the place of that row when required. Settings and the independent GitHub switch follow.

## Elevation & Depth

Pale fills and one-pixel rules separate sections on a flat surface. A lighter panel groups the current page controls. The tinted consent area groups the decision and its explanation.

## Shapes

Buttons, the password field, and the consent area use 8px corners. The GitHub switch has a circular thumb that moves right when checked.

## Components

### Actions and status

Use a filled primary action and an outlined secondary action for translating and restoring. Main buttons have a 42px minimum height. The test and clear controls use 12px type and a 36px minimum height. A pale fill signals that the primary action is disabled. Announce progress and outcomes through status text near the action.

### Send confirmation

Place consent below the current-page status. Name the destination and explain that the confirmation applies to the current page. Offer a filled confirm button and an outlined cancel button. When consent opens, focus the confirm button. When it closes, move focus to the available page action or status line.

### Settings disclosure and switch

Use native details and summary for DeepSeek settings. Keep configuration state visible in the summary and rotate the chevron when expanded. Start with settings expanded when the API Key is missing. Use a labeled password input and a separate labeled switch for GitHub interface translation. Keep a visible 2px green focus outline with a 3px offset on buttons, inputs, and the summary.
