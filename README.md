# ASF-STM userscript

## Installation

To install this script, go to [the latest release](https://github.com/iBreakEverything/ASF-STM-Enhancement/releases/latest) and click on "ASF-STM.user.js" entry in assets.

## Description

It does what the original [ASF-STM (by Rudokhvist)](https://github.com/Rudokhvist/ASF-STM) script does with some extra features.

# Added features
- Friend match: match with your public-inventory friends (friends-only/private inventories will mark the badges as private).
- Scan filters: you don't want to scan the badges every time? add some filters and reduce your scan time considerably!
- Updated UI for better UX: buttons are now clickable (not just the text), nickname sanitization, scrollable menus, link to trade partener's badge.
- **DEV** Templates: now it's easier to work on those JavaScript template strings containing HTML or CSS.
- **DEV** Build tool: script is automatically compiled, templates are minified and version bump triggers the release workflow.
- **DEV** Automatic releases: every version bump a draft release will be generated for convenience.

## WIP:
-   Whitespace removal e.g. `createSortSelect(0).replaceAll(/(  |\n)/g, '')` or template integration for all HTML
-   Change save filters logic (new bug: inactive filters duplication)
-   Warning on tab close
-   add .html.js to filenames + rule for extra checking?
```
<span class="fadeout">test</span>

.fadeout {
    visibility: hidden;
    opacity: 0;
    transition: visibility 1s 2s, opacity 1s 2s linear;
}

Object.assign(document.querySelector('.fadeout').style,{visibility: 'visible', opacity: 1, transition: 'none'})
document.querySelector('.fadeout').removeAttribute('style')
```

## Changelog

Version | Date | Info
:-: | :-: | :-
v5.1.0 | TBD | TBD
v5.0.13 | 2024-12-27 | Fiends, Filters and CI/CD
v4.2 | 2024-10-22 | Latest [ASF-STM](https://github.com/Rudokhvist/ASF-STM) release by Rudokhvist
