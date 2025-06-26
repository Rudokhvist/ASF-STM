# ASF-STM userscript

## Installation

To install this script, go to [greasyfork](https://greasyfork.org/en/scripts/404754-asf-stm) and press "Install this script" button.

## Description

Those of you who craft steam badges probably know and use https://www.steamtradematcher.com/ site.
Unfortunately, this site can't now work well, because of new changes in Steam rate limits. You have to wait to sync your inventory, then you have to wait in a queue to make matching, and then results are also a bit outdated, because bot inventories are cached. Still great tool, but not as useful as before.
Also some of you may know that [ASF](https://github.com/JustArchiNET/ArchiSteamFarm/), popular tool to farm cards, also have an official plugin that implements alternative to STM, and [public list of bots](https://asf.justarchi.net/STM), involved in this process. But while you may easily setup your account as automatic bot and enroll in listing - you can't actually match without paying money to Archi - for the same reason as above - steam rate limits are too low now, so Archi maintains a pool of proxies for matching to work, this feature can't be free anymore.
So, since when I made this script, you have a third alternative - this script can use api of ASF public listing to match your badges with all available bots! Be warned though, that you can still get temporary inventory ban for trading with bots with huge inventories (but matching process itself is safe, only actualy sending trade is affected). After installing this script, you can find a button for scan for possible matches on [your badges page](https://steamcommunity.com/my/badges/), as well as a button for configuration of this script.

### Pros:

- Unlike majority of tools after steam rate limits update, it works!
- It's free!
- You don't need ASF, just an userscript in your browser. Perfect if you only want to find matches occasionally, not all the time.
- Unlike STM, it's executed on your PC, so it will always work (may be unstable though if steam is under heavy load)
- You send all trades yourself, so everything is under your control.
- You only trade with bots, so your trades will be confirmed almost instantly (if everything is okay)
- Automatically adds cards to trade offer, can auto-send it too if you want.

### Cons:

- Only works with ASF listing. You can't find matches with your friends or other users, you still need STM for this.
- Pretty slow. May take an hour or even more to scan all bots. Depends on how many badges you need to find matches for. You can limit bots you want to trade with in configuration section.
- It may still lack some of STM features.

Consider this a permanent beta version, it's very raw and may contain bugs. So, please, check every trade before sending and report bugs and suggestions.
If you want to participate in development - feel free to send [issues](https://github.com/Rudokhvist/ASF-STM/issues) and [pull requests](https://github.com/Rudokhvist/ASF-STM/pulls)!

![ASF_STM](https://github.com/user-attachments/assets/25785010-27b2-492b-9c6c-ef80027b884b)

## Future plans and TODOs:

- For now script works only with regular cards. I plan to add foil cards matching too
- Add an option to match cards for already completed badges too.
- Add whitelist/blacklist of matched apps, to make it possible to match only a couple of needed badges without wasting time on the rest.
- ??? your suggestions. Use [issues](https://github.com/Rudokhvist/ASF-STM/issues) for those. (LOL, I have too much TODO already, fat chance!)

## Changelog (may be incomplete, just for nostalgia reasons)

v0.1 2020-06-05 - First release</br>
v0.2 2020-06-08 - changed an appid detecting logic to avoid false matches. changed getPartner to bigint (faster)</br>
v0.3 2020-06-09 - Now script don't stop on 403 error, just tries next bot. Also added indicator for bots with matchEverything=1.</br>
v1.0 2020-06-13 - Added filters; Removed delay between requests; Some improvements & Fixes</br>
v1.1 2020-06-15 - Added stop button; fixed incorrect behavior upon restart</br>
v1.2 2020-06-16 - added "all", "none", "invert" to filters; further improved error handling; code style improved</br>
v1.3 2020-06-17 - updated for compatibility with greasemonkey; fixed check for "no cards to match", now script don't scan bots in this case.</br>
v1.4 2020-06-21 - fixed matching logic, now finds more matches; improved compatibility with greasemonkey and old browsers</br>
v2.1 2022-12-13 - Completely re-worked script that works with new steam rate limits. Also, uses new ASF STM backend endpoint!</br>
v2.3 2022-12-14 - Fixed some bugs, added display of total number of items in bot's inventory.</br>
v2.4 2022-12-16 - Fixed a lot of different issues, script should now work more stable.</br>
v2.5 2022-12-16 - More fixes</br>
v2.7 2022-12-18 - Greatly improved fetching of card classids. Added caching of bots list to reduce load on ASF backend.</br>
v2.8 2022-12-22 - Fixed a bug that prevented functioning during sale.</br>
v2.9 2023-01-23 - ASF backend api update</br>
v2.10 2023-04-21 - Scroll added to filter window, results sorted by game name, Thanks to [@ngoclong19](https://github.com/ngoclong19) for PR!</br>
v3.3 2023-07-06 - Major update! Integrated (modified) STM helper script, added configuration, added blacklist, fixed bugs.</br>
v4.1 2024-07-01 - Major update - rework communication with helper script part, prevent "item not found errors", minor fixes and improvements</br>
v4.2 2024-10-22 - Add "Filter all" button to matches, contribution by [@iBreakEverything](https://github.com/iBreakEverything)</br>
v4.3 2025-06-26 - Don't try to match with bots that don't have `Cards` in `MatchableTypes` (thanks [@nolddor](https://github.com/nolddor)!)

## Hopefully it will be useful to someone.
