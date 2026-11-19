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
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.035em"
  headline:
    fontSize: "17px"
    lineHeight: 1.3
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontSize: "12px"
rounded:
  control: "7px"
  panel: "8px"
  switch: "20px"
spacing:
  row-gap: "8px"
  panel-inset: "12px"
  popup-inset: "20px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
  button-primary-hover:
    backgroundColor: "{colors.teal-hover}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.teal-soft}"
  input-key:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 9px"
  panel-consent:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-inset}"
  switch:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.switch}"
    width: "38px"
    height: "22px"
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

Georgia anchors the wordmark at 34px. A system font stack led by PingFang SC and Microsoft YaHei carries the Simplified Chinese UI at 14px. The current-page heading is 17px, and hints, feedback, and setting states are 12px. Controls and disclosure labels use weight 600.

## Layout

The popup is a single column, 360px wide with a viewport cap and 20px of padding. The wordmark and language direction align along their baselines. Current-page status precedes the translate and restore row, followed by consent when required, then settings and the independent GitHub switch. Action pairs share available width and can wrap with an 8px gap. The password field and save button stay on one row.

## Elevation & Depth

Pale fills and one-pixel rules separate sections on a flat surface. The consent panel alone uses a tinted container around a decision and its explanation.

## Shapes

Buttons and the password field use 7px corners. The consent panel uses 8px corners. The GitHub switch is a pill with a circular thumb that moves right when checked.

## Components

### Actions and status

Use a filled primary action and an outlined secondary action for translating and restoring. Main buttons have a 36px minimum height. The test and clear controls use 12px type and a 31px minimum height. Disabled controls use reduced opacity. Announce change through status text near the action.

### Send confirmation

Place consent directly below the current-page actions. Name the destination and explain that the confirmation applies to the current page. Offer a filled confirm button and an outlined cancel button. When consent opens, focus the confirm button. When it closes, move focus to the available page action or status line.

### Settings disclosure and switch

Use native details and summary for DeepSeek settings. Keep configuration state visible in the summary and rotate the chevron when expanded. Start with settings expanded when the API Key is missing. Use a labeled password input and a separate labeled switch for GitHub interface translation. Keep a visible 2px green focus outline with a 3px offset on buttons, inputs, and the summary.
