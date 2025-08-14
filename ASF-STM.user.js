// ==UserScript==
// @name            ASF STM
// @namespace       https://greasyfork.org/users/2205
// @description     ASF bot list trade matcher
// @description:vi  Trình khớp lệnh giao dịch danh sách bot ASF
// @license         Apache-2.0
// @author          Rudokhvist
// @match           *://steamcommunity.com/id/*/badges
// @match           *://steamcommunity.com/id/*/badges/
// @match           *://steamcommunity.com/profiles/*/badges
// @match           *://steamcommunity.com/profiles/*/badges/
// @match           *://steamcommunity.com/tradeoffer/new/*source=asfstm*
// @version         4.4
// @connect         asf.justarchi.net
// @grant           GM.xmlHttpRequest
// @grant           GM_addStyle
// @grant           GM_xmlhttpRequest
// @downloadURL https://update.greasyfork.org/scripts/404754/ASF%20STM.user.js
// @updateURL https://update.greasyfork.org/scripts/404754/ASF%20STM.meta.js
// ==/UserScript==

(function () {
    "use strict";

    let myProfileLink = "";
    let errors = 0;
    let bots = null;
    let myBadges = [];
    let botBadges = [];
    let maxPages;
    let stop = false;
    let botCacheTime = 5 * 60000;
    let globalSettings = null;
    let blacklist = [];
    let defaultSettings = {
        anyBots: true,
        fairBots: true,
        sortByName: true,
        sortBotsBy: ["MatchEverythingFirst", "TotalGamesCountDesc", "TotalItemsCountDesc", "TotalInventoryCountAsc", "None"],
        botMinItems: 0,
        botMaxItems: 0,
        weblimiter: 300,
        errorLimiter: 30000,
        debug: false,
        maxErrors: 3,
        filterBackgroundColor: "rgba(23,26,33,0.8)",
        // for trade offer
        tradeMessage: "ASF STM Matcher",
        autoSend: false,
        doAfterTrade: "NOTHING",
        order: "AS_IS",
    };
    let cardNames = new Set();
    let tradeParams = {
        matches: {},
        filter: [],
    };

    //styles
    const css = `
    #asf_stm_filters_body {
        max-height: calc(100vh - 95px);
        overflow-y: auto;
    }
    .asf_stm_tabs{
        width: 600px;
        display: block;
        margin: 40px auto;
        position: relative;
    }
    .asf_stm_tabs .asf_stm_tab{
        float: left;
        display: block;
    }
    .asf_stm_tabs .asf_stm_tab>input[type="radio"] {
        position: absolute;
        top: -9999px;
        left: -9999px;
    }
    .asf_stm_tabs .asf_stm_tab>label {
        display: block;
        padding: 6px 21px;
        cursor: pointer;
        position: relative;
        color: #FFF;
        background: #4A83FD;
    }
    .asf_stm_tabs .asf_stm_content {
        display: none;
        overflow: hidden;
        width: 630px;
        height: 380px;
        padding: 5px;
        position: absolute;
        top: 27px;
        left: 0;
        background: #303030;
        color: #DFDFDF;
    }
    .asf_stm_tabs>.asf_stm_tab>[id^="asf_stm_tab"]:checked + label {
        top: 0;
        background: #303030;
        color: #F5F5F5;
    }
    .asf_stm_tabs>.asf_stm_tab>[id^="asf_stm_tab"]:checked ~ [id^="asf_stm_tab-content"] {
        display: block;
    }
    textarea {
      resize: none;
    }
    `;

    function debugTime(name) {
        if (globalSettings.debug) {
            console.time(name);
        }
    }

    function debugTimeEnd(name) {
        if (globalSettings.debug) {
            console.timeEnd(name);
        }
    }

    function debugPrint(msg) {
        if (globalSettings.debug) {
            console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }) + " : " + msg);
        }
    }

    function deepClone(object) {
        return JSON.parse(JSON.stringify(object));
    }

    function getPartner(str) {
        if (typeof BigInt !== "undefined") {
            return (BigInt(str) % BigInt(4294967296)).toString(); // eslint-disable-line
        } else {
            let result = 0;
            for (let i = 0; i < str.length; i++) {
                result = (result * 10 + Number(str[i])) % 4294967296;
            }
            return result.toString();
        }
    }

    function arrayToText(array) {
        return array.join(",\n");
    }

    function textToArray(text) {
        let res = [];
        text.split(",").forEach(function (elem) {
            if (/^\d+$/.test(elem.trim())) {
                res.push(elem.trim());
            }
        });
        return res;
    }

    function hexToRgba(hex) {
        return "rgba(" + [Number("0x" + hex.substring(1, 3)), Number("0x" + hex.substring(3, 5)), Number("0x" + hex.substring(5, 7))].join(",") + ",1)";
    }

    function rgbaToHex(rgba) {
        let re = /rgba\(([.\d]+),([.\d]+),([.\d]+),([.\d]+)\)/g;
        let result = re.exec(rgba);
        if (result === null || result.length !== 5) {
            debugPrint("failed to parse color!");
            return ["#171a21", 0.8];
        }
        return ["#" + Number(result[1]).toString(16) + Number(result[2]).toString(16) + Number(result[3]).toString(16), Number(result[4])];
    }

    function mixAlpha(rgba, alpha) {
        let re = /(rgba\([.\d]+,[.\d]+,[.\d]+,)([.\d]+)\)/g;
        let result = re.exec(rgba);
        if (result) {
            return result[1] + alpha + ")";
        }
        debugPrint("failed to mix alpha!");
        return rgba;
    }

    function ShowConfigDialog() {
        let filterBG = rgbaToHex(globalSettings.filterBackgroundColor);
        let configDialogTemplate = `
              <div style="height:420px; margin-top:-20px; font-size:12px;margin-left: -20px;width: 620px;" >
              <ul style="margin: 0;padding: 0;" class="asf_stm_tabs">
                <li class="asf_stm_tab">
                  <input name="asf_stm_tabs" checked="checked"
               id="asf_stm_tab1" type="radio"><label
               for="asf_stm_tab1">Matcher</label>
                  <div id="asf_stm_tab-content1" class="asf_stm_content">
                  <fieldset style="padding-top: 0px;"><legend>BOTS TO MATCH</legend>
                  <div style="margin-bottom: 6px;"> Match with "Any"
              bots:&nbsp;<input style="background-color: #171d25; color: white;"
               id="anyBots" ${globalSettings.anyBots ? 'checked="checked"' : ""} type="checkbox">&nbsp;Match
              with "Fair"
              bots:&nbsp;<input style="background-color: #171d25; color: white;"
               id="fairBots" ${globalSettings.fairBots ? 'checked="checked"' : ""} type="checkbox"><br>
                  </div>
                  <div style="margin-bottom: 6px;"> Minimum
              items:&nbsp;<input min=0 style="background-color: #171d25; color: white;"
               id="botMinItems" value=${globalSettings.botMinItems} type="number">&nbsp;Maximum
              items:&nbsp;<input min=0 style="background-color: #171d25; color: white;"
               id="botMaxItems" value=${globalSettings.botMaxItems} type="number"><a class="tooltip hover_tooltip" data-tooltip-text="Don't match with bots
               that has less or more than required limit of items in steam inventory. 0 means no limit on number of items">
              <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                  <br>
                  </div>
                  <div style="margin-bottom: 6px;">
                  <span style="width: 80px; display: inline-block;">Sort bots by:</span>
                  <select style="background-color: #171d25; color: white;"
               id="sortBotsBy0">
                  <option value="MatchEverythingFirst" ${globalSettings.sortBotsBy[0] === "MatchEverythingFirst" ? 'selected="selected"' : ""}>"Any"
              bots first</option>
                  <option value="MatchEverythingLast" ${globalSettings.sortBotsBy[0] === "MatchEverythingLast" ? 'selected="selected"' : ""}>"Any" bots last</option>
                  <option value="TotalGamesCountDesc" ${globalSettings.sortBotsBy[0] === "TotalGamesCountDesc" ? 'selected="selected"' : ""}>Total games count, descending</option>
                  <option value="TotalGamesCountAsc" ${globalSettings.sortBotsBy[0] === "TotalGamesCountAsc" ? 'selected="selected"' : ""}>Total games count, ascending</option>
                  <option value="TotalItemsCountDesc" ${globalSettings.sortBotsBy[0] === "TotalItemsCountDesc" ? 'selected="selected"' : ""}>Total matchable items count,
              descending</option>
                  <option value="TotalItemsCountAsc" ${globalSettings.sortBotsBy[0] === "TotalItemsCountAsc" ? 'selected="selected"' : ""}>Total matchable items count,
              ascending</option>
                  <option value="TotalInventoryCountDesc" ${globalSettings.sortBotsBy[0] === "TotalInventoryCountDesc" ? 'selected="selected"' : ""}>Total inventory count, descending</option>
                  <option value="TotalInventoryCountAsc" ${globalSettings.sortBotsBy[0] === "TotalInventoryCountAsc" ? 'selected="selected"' : ""}>Total inventory count, ascending</option>
                  <option value="None" ${globalSettings.sortBotsBy[0] === "None" ? 'selected="selected"' : ""}>None</option>
                  </select>
                  </div>
                  <div style="margin-bottom: 6px;"><span
               style="width: 80px; display: inline-block;"> …then by:</span>
                  <select style="background-color: #171d25; color: white;" id="sortBotsBy1">
                  <option value="MatchEverythingFirst" ${globalSettings.sortBotsBy[1] === "MatchEverythingFirst" ? 'selected="selected"' : ""}>"Any"
              bots first</option>
                  <option value="MatchEverythingLast" ${globalSettings.sortBotsBy[1] === "MatchEverythingLast" ? 'selected="selected"' : ""}>"Any" bots last</option>
                  <option value="TotalGamesCountDesc" ${globalSettings.sortBotsBy[1] === "TotalGamesCountDesc" ? 'selected="selected"' : ""}>Total games count, descending</option>
                  <option value="TotalGamesCountAsc" ${globalSettings.sortBotsBy[1] === "TotalGamesCountAsc" ? 'selected="selected"' : ""}>Total games count, ascending</option>
                  <option value="TotalItemsCountDesc" ${globalSettings.sortBotsBy[1] === "TotalItemsCountDesc" ? 'selected="selected"' : ""}>Total matchable items count,
              descending</option>
                  <option value="TotalItemsCountAsc" ${globalSettings.sortBotsBy[1] === "TotalItemsCountAsc" ? 'selected="selected"' : ""}>Total matchable items count,
              ascending</option>
                  <option value="TotalInventoryCountDesc" ${globalSettings.sortBotsBy[1] === "TotalInventoryCountDesc" ? 'selected="selected"' : ""}>Total inventory count, descending</option>
                  <option value="TotalInventoryCountAsc" ${globalSettings.sortBotsBy[1] === "TotalInventoryCountAsc" ? 'selected="selected"' : ""}>Total inventory count, ascending</option>
                  <option value="None" ${globalSettings.sortBotsBy[1] === "None" ? 'selected="selected"' : ""}>None</option>
                  </select>
                  </div>
                  <div style="margin-bottom: 6px;"><span
               style="width: 80px; display: inline-block;">…then by:</span>
                  <select style="background-color: #171d25; color: white;"
               id="sortBotsBy2">
                  <option value="MatchEverythingFirst" ${globalSettings.sortBotsBy[2] === "MatchEverythingFirst" ? 'selected="selected"' : ""}>"Any"
              bots first</option>
                  <option value="MatchEverythingLast" ${globalSettings.sortBotsBy[2] === "MatchEverythingLast" ? 'selected="selected"' : ""}>"Any" bots last</option>
                  <option value="TotalGamesCountDesc" ${globalSettings.sortBotsBy[2] === "TotalGamesCountDesc" ? 'selected="selected"' : ""}>Total games count, descending</option>
                  <option value="TotalGamesCountAsc" ${globalSettings.sortBotsBy[2] === "TotalGamesCountAsc" ? 'selected="selected"' : ""}>Total games count, ascending</option>
                  <option value="TotalItemsCountDesc" ${globalSettings.sortBotsBy[2] === "TotalItemsCountDesc" ? 'selected="selected"' : ""}>Total matchable items count,
              descending</option>
                  <option value="TotalItemsCountAsc" ${globalSettings.sortBotsBy[2] === "TotalItemsCountAsc" ? 'selected="selected"' : ""}>Total matchable items count,
              ascending</option>
                  <option value="TotalInventoryCountDesc" ${globalSettings.sortBotsBy[2] === "TotalInventoryCountDesc" ? 'selected="selected"' : ""}>Total inventory count, descending</option>
                  <option value="TotalInventoryCountAsc" ${globalSettings.sortBotsBy[2] === "TotalInventoryCountAsc" ? 'selected="selected"' : ""}>Total inventory count, ascending</option>
                  <option value="None" ${globalSettings.sortBotsBy[2] === "None" ? 'selected="selected"' : ""}>None</option>
                  </select>
                  </div>
                  <div style="margin-bottom: 6px;"><span
               style="width: 80px; display: inline-block;">…then by:</span>
                  <select style="background-color: #171d25; color: white;"
               id="sortBotsBy3">
                  <option value="MatchEverythingFirst" ${globalSettings.sortBotsBy[3] === "MatchEverythingFirst" ? 'selected="selected"' : ""}>"Any"
              bots first</option>
                  <option value="MatchEverythingLast" ${globalSettings.sortBotsBy[3] === "MatchEverythingLast" ? 'selected="selected"' : ""}>"Any" bots last</option>
                  <option value="TotalGamesCountDesc" ${globalSettings.sortBotsBy[3] === "TotalGamesCountDesc" ? 'selected="selected"' : ""}>Total games count, descending</option>
                  <option value="TotalGamesCountAsc" ${globalSettings.sortBotsBy[3] === "TotalGamesCountAsc" ? 'selected="selected"' : ""}>Total games count, ascending</option>
                  <option value="TotalItemsCountDesc" ${globalSettings.sortBotsBy[3] === "TotalItemsCountDesc" ? 'selected="selected"' : ""}>Total matchable items count,
              descending</option>
                  <option value="TotalItemsCountAsc" ${globalSettings.sortBotsBy[3] === "TotalItemsCountAsc" ? 'selected="selected"' : ""}>Total matchable items count,
              ascending</option>
                  <option value="TotalInventoryCountDesc" ${globalSettings.sortBotsBy[3] === "TotalInventoryCountDesc" ? 'selected="selected"' : ""}>Total inventory count, descending</option>
                  <option value="TotalInventoryCountAsc" ${globalSettings.sortBotsBy[3] === "TotalInventoryCountAsc" ? 'selected="selected"' : ""}>Total inventory count, ascending</option>
                  <option value="None" ${globalSettings.sortBotsBy[3] === "None" ? 'selected="selected"' : ""}>None</option>
                  </select>
                  </div>
                  </fieldset>
                  <fieldset style="padding-top: 0px;"><legend>INTERFACE</legend>
                  <div style="margin-bottom: 6px;"> Game filter pop-up
              background color:&nbsp;<input
               style="background-color: #171d25; color: white; height: 20px; padding: 2px;"
               id="filterBackgroundColor" value="${filterBG[0]}" type="color">&nbsp;opacity:&nbsp;<input
               style="height: 4px;"
               id="filterBackgroundAlpha" min=0 max=1
               step=0.01 value=${filterBG[1]} type="range"><br>
                  </div>
                  <div style="margin-bottom: 6px;"> Sort results by game
              name:&nbsp;<input
               style="border: medium none transparent; background-color: #171d25; color: white;"
               id="sortByName" ${globalSettings.sortByName ? 'checked="checked"' : ""} type="checkbox">
                  </div>
                  </fieldset>
                  <fieldset style="padding-top: 0px;"><legend>SETTINGS</legend>
                    <fieldset style="padding-top: 0px; float: right; width:200px;"><legend>DEVELOPER</legend>
                                    <div style="margin-bottom: 6px;">Debug:&nbsp;
                                    <input style="background-color: #171d25; color: white;"
                                    id="debug" type="checkbox"  ${globalSettings.debug ? 'checked="checked"' : ""} >
                                     <a class="tooltip hover_tooltip" data-tooltip-text="Enable additional output to console">
                                     <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                                    </div>
                    </fieldset>
                  <div style="margin-bottom: 6px;"> Web limiter delay,
              ms:&nbsp;<input class="price_option_input"
               style="border: medium none transparent; background-color: #171d25; color: white;"
               id="weblimiter" value= ${globalSettings.weblimiter}  min=0 type="number"></div>
                  <div style="margin-bottom: 6px;"> Delay on error,
              ms:&nbsp;<input class="price_option_input"
               style="background-color: #171d25; color: white;"
               id="errorLimiter" value=${globalSettings.errorLimiter} min=0 type="number"></div>
                  <div style="margin-bottom: 6px;"> Max errors:&nbsp;<input
               class="price_option_input"
               style="background-color: #171d25; color: white;"
               id="maxErrors" value=${globalSettings.maxErrors} min=0 type="number"></div>
                  </div>
                  </fieldset>
                </li>
                <li class="asf_stm_tab">
                  <input name="asf_stm_tabs" id="asf_stm_tab2"
               type="radio"><label for="asf_stm_tab2">Trade
              helper</label>
                  <div id="asf_stm_tab-content2" class="asf_stm_content">
                  <br>
                  <fieldset><legend>TRADE OFFER MESSAGE</legend>
                  <textarea style="background-color: #171d25; color: white;" id="tradeMessage" name="tradeMessage" rows="4"
               cols="60">${globalSettings.tradeMessage}</textarea>
                  <a class="tooltip hover_tooltip" data-tooltip-text="Custom text that will be included automatically with your
              trade offers created through STM while using this userscript. To remove this functionality, simply delete the text.">
              <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                  </fieldset>
                  <br>
                  <fieldset><legend>ACTION AFTER TRADE
                  </legend>
                  <label for="after-trade">After
              trade...</label>
                  <select style="background-color: #171d25; color: white;" name="after-trade" id="doAfterTrade">
                  <option value="NOTHING" ${globalSettings.doAfterTrade === "NOTHING" ? 'selected="selected"' : ""}>Do
              Nothing</option>
                  <option value="CLOSE_WINDOW" ${globalSettings.doAfterTrade === "CLOSE_WINDOW" ? 'selected="selected"' : ""}>Close window</option>
                  <option value="CLICK_OK" ${globalSettings.doAfterTrade === "CLICK_OK" ? 'selected="selected"' : ""}>Click OK</option>
                  </select>
                  <a class="tooltip hover_tooltip" data-tooltip-html="
                  <p>Determines what happens when you complete a trade offer.</p>
                  <ul>
                    <li><strong>Do nothing</strong>: Will do
              nothing more than the normal behavior.</li>
                    <li><strong>Close window</strong>: Will close
              the window after the trade offer is sent.</li>
                    <li><strong>Click OK</strong>: Will redirect
              you to the trade offers recap page.</li>
                  </ul>">
                  <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                  </fieldset>
                  <br>
                  <fieldset><legend>CARDS OFFER
                  </legend>
                  <label for="cards-order">Cards
              order</label>
                  <select style="background-color: #171d25; color: white;" class="form-control" name="cards-order"
               id="order">
                  <option value="SORT" ${globalSettings.order === "SORT" ? 'selected="selected"' : ""}>Sorted</option>
                  <option value="RANDOM" ${globalSettings.order === "RANDOM" ? 'selected="selected"' : ""}>Random</option>
                  <option value="AS_IS" ${globalSettings.order === "AS_IS" ? 'selected="selected"' : ""}>As is</option>
                  </select>
                   <a class="tooltip hover_tooltip" data-tooltip-html="
                   <p>Determines which card is added to trade.</p>
                  <ul>
                    <li><strong>Sorted</strong>: Will sort cards by
              their IDs before adding to trade. If you make several trade offers with
              the same card and one of them is accepted, the rest will have message
              &quot;cards unavilable to trade&quot;.</li>
                    <li><strong>Random</strong>: Will add cards to
              trade randomly. If you make several trade offers and one of them is
              accepted, only some of them will be unavilable for trade.</li>
                    <li><strong>As is</strong>: Script doesn't
              change anything in order. Results vary depending on browser, steam
              servers, weather...</li>
                  </ul>">
                  <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                  </fieldset>
                  <br>
                  <fieldset><legend>AUTO-SEND TRADE OFFER
                  </legend>
                  <label for="auto-send"><input style="background-color: #171d25; color: white;" name="auto-send"
               id="autoSend" value="1" type="checkbox" ${globalSettings.autoSend ? 'checked="checked"' : ""}>
              Enable</label>
                   <a class="tooltip hover_tooltip" data-tooltip-text="Makes it possible for the script to automatically send
              trade offers without any action on your side. This is not recommended
              as you should always check your trade offers, but, well, this is a
              possible thing. Please note that incomplete trade offers (missing
              cards, ...) won't be sent automatically even when this parameter is set
              to true.">
              <img src="https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png"></a>
                  </fieldset>
                  </div>
                </li>
                <li class="asf_stm_tab">
                  <input name="asf_stm_tabs" id="asf_stm_tab3"
               type="radio"><label for="asf_stm_tab3">Blacklist</label>
                  <div id="asf_stm_tab-content3" class="asf_stm_content">
                  <div class="title_text profile_xp_block_remaining"><h1>Comma-separated list of ignored steamIDs</h1><div><div>
                  <textarea style="background-color: #171d25; color: white;" id="blacklist" name="Blacklist" rows="17"
               cols="63">${arrayToText(blacklist)}</textarea></div>
                </li>
              </ul>
              </div>
        `;
        let templateElement = document.createElement("template");
        templateElement.innerHTML = configDialogTemplate.trim();
        let configDialog = templateElement.content.firstChild;

        unsafeWindow.ShowConfirmDialog("ASF STM Configuration", configDialog, "Save", "Cancel", "Reset").done(function (button) {
            if (button === "OK") {
                globalSettings.anyBots = configDialog.querySelector("#anyBots").checked;
                globalSettings.fairBots = configDialog.querySelector("#fairBots").checked;
                globalSettings.sortByName = configDialog.querySelector("#sortByName").checked;
                let newsortBotsBy = [];
                configDialog.querySelectorAll("[id^=sortBotsBy").forEach(function (elem) {
                    newsortBotsBy.push(elem.selectedOptions[0].value);
                });
                globalSettings.sortBotsBy = newsortBotsBy;
                let newbotMinItems = Number(configDialog.querySelector("#botMinItems").value);
                globalSettings.botMinItems = isNaN(newbotMinItems) ? globalSettings.botMinItems : newbotMinItems;
                let newbotMaxItems = Number(configDialog.querySelector("#botMaxItems").value);
                globalSettings.botMaxItems = isNaN(newbotMaxItems) ? globalSettings.botMaxItems : newbotMaxItems;
                let newweblimiter = Number(configDialog.querySelector("#weblimiter").value);
                globalSettings.weblimiter = isNaN(newweblimiter) ? globalSettings.weblimiter : newweblimiter;
                let newerrorLimiter = Number(configDialog.querySelector("#errorLimiter").value);
                globalSettings.errorLimiter = isNaN(newerrorLimiter) ? globalSettings.errorLimiter : newerrorLimiter;
                globalSettings.debug = configDialog.querySelector("#debug").checked;
                let newmaxErrors = Number(configDialog.querySelector("#maxErrors").value);
                globalSettings.maxErrors = isNaN(newmaxErrors) ? globalSettings.maxErrors : newmaxErrors;
                globalSettings.filterBackgroundColor = mixAlpha(hexToRgba(configDialog.querySelector("#filterBackgroundColor").value), configDialog.querySelector("#filterBackgroundAlpha").value);
                globalSettings.tradeMessage = configDialog.querySelector("#tradeMessage").value;
                globalSettings.autoSend = configDialog.querySelector("#autoSend").checked;
                globalSettings.doAfterTrade = configDialog.querySelector("#doAfterTrade").selectedOptions[0].value;
                globalSettings.order = configDialog.querySelector("#order").selectedOptions[0].value;
                blacklist = textToArray(configDialog.querySelector("#blacklist").value);
                SaveConfig();
                unsafeWindow.ShowConfirmDialog("CONFIRMATION", "Some changes may not work prior to page reload. Do you want to reload the page?").done(function () {
                    document.location.reload();
                });
            } else {
                unsafeWindow.ShowConfirmDialog("CONFIRMATION", "Are you sure you want to restore default settings?").done(function () {
                    ResetConfig();
                    SaveConfig();
                    unsafeWindow.ShowConfirmDialog("CONFIRMATION", "Some changes may not work prior to page reload. Do you want to reload the page?").done(function () {
                        document.location.reload();
                    });
                });
            }
        });
    }

    function ResetConfig() {
        //we won't clear blacklist here!
        globalSettings = deepClone(defaultSettings);
    }

    function SaveConfig() {
        localStorage.setItem("Ryzhehvost.ASF.STM.Settings", JSON.stringify(globalSettings));
        localStorage.setItem("Ryzhehvost.ASF.STM.Blacklist", JSON.stringify(blacklist));
    }

    function LoadConfig() {
        globalSettings = JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM.Settings"));
        blacklist = JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM.Blacklist"));
        if (globalSettings === null) {
            ResetConfig();
        }
        if (blacklist === null) {
            blacklist = [];
        }
        //vaildate config
        Object.keys(defaultSettings).forEach(function (key) {
            if (!globalSettings.hasOwnProperty(key)) {
                globalSettings[key] = defaultSettings[defaultSettings];
            }
        });
    }

    function SaveParams() {
        if (tradeParams.cardNames === undefined) {
            tradeParams.cardNames = Array.from(cardNames);
        }
        debugPrint(JSON.stringify(tradeParams.filter));
        localStorage.setItem("Ryzhehvost.ASF.STM.Params", JSON.stringify(tradeParams));
    }

    function LoadParams() {
        return JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM.Params"));
    }

    function enableButton() {
        let buttonDiv = document.getElementById("asf_stm_button_div");
        buttonDiv.setAttribute("class", "profile_small_header_additional");
        buttonDiv.setAttribute("title", "Scan ASF STM");
        let button = document.getElementById("asf_stm_button");
        button.addEventListener("click", buttonPressedEvent, false);
    }

    function disableButton() {
        let buttonDiv = document.getElementById("asf_stm_button_div");
        buttonDiv.setAttribute("class", "profile_small_header_additional btn_disabled");
        buttonDiv.setAttribute("title", "Scan is in process");
        let button = document.getElementById("asf_stm_button");
        button.removeEventListener("click", buttonPressedEvent, false);
    }

    function updateMessage(text) {
        let message = document.getElementById("asf_stm_message");
        message.textContent = text;
    }

    function hideMessage() {
        let messageBox = document.getElementById("asf_stm_messagebox");
        messageBox.setAttribute("style", "display: none;");
    }

    function hideThrobber() {
        let throbber = document.getElementById("throbber");
        throbber.setAttribute("style", "display: none;");
    }

    function updateProgress(index, total) {
        const bar = document.getElementById("asf_stm_progress");
        let progress = 0;
        if (total > 0) {
            progress = 100 * ((index + 1) / total);
        }
        bar.style.width = `${progress}%`;
        bar.style.transitionDuration = "0.5s";
        if (progress === 100) {
            bar.style.transitionDuration = "0s";
        }
    }

    function blacklistEventHandler(event) {
        let steamID = event.currentTarget.id.split("_")[1];
        if (blacklist.includes(steamID)) {
            return;
        }

        unsafeWindow.ShowConfirmDialog("CONFIRMATION", `Are you sure you want to blacklist bot ${steamID} ?`).done(function () {
            blacklist.push(steamID);
            SaveConfig();
        });
    }

    function filterAllEventHandler(event) {
        let appIds = event.target.name.split(",");
        appIds = appIds.map((id) => "astm_" + id);
        for (let appId of appIds) {
            let target = document.querySelector("#" + appId);
            if (target && target.checked) {
                target.click();
            }
        }
    }

    function populateCards(item) {
        let htmlCards = "";
        for (let j = 0; j < item.cards.length; j++) {
            let itemIcon = item.cards[j].iconUrl;
            let itemName = item.cards[j].item;
            for (let k = 0; k < item.cards[j].count; k++) {
                let cardTemplate = `
                          <div class="showcase_slot">
                            <img class="image-container" src="${itemIcon}/98x115">
                            <div class="commentthread_subscribe_hint" style="width: 98px;">${itemName}</div>
                          </div>
                `;
                htmlCards += cardTemplate;
            }
        }
        return htmlCards;
    }

    function checkRow(row) {
        debugPrint("checkRow");
        let matches = row.getElementsByClassName("badge_row");
        let visible = false;
        for (let i = 0; i < matches.length; i++) {
            if (matches[i].parentElement.style.display !== "none") {
                visible = true;
                break;
            }
        }
        if (visible) {
            row.style.display = "block";
        } else {
            row.style.display = "none";
        }
    }

    function addMatchRow(index) {
        debugPrint("addMatchRow " + index);
        let itemsToSend = bots.Result[index].itemsToSend;
        let itemsToReceive = bots.Result[index].itemsToReceive;

        // sort by game name
        function compareNames(a, b) {
            const nameA = a.title;
            const nameB = b.title;
            if (nameA < nameB) {
                return -1;
            }
            if (nameA > nameB) {
                return 1;
            }
            return 0;
        }

        if (globalSettings.sortByName) {
            itemsToSend.sort(compareNames);
            itemsToReceive.sort(compareNames);
        }

        let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=" + getPartner(bots.Result[index].SteamID) + "&token=" + bots.Result[index].TradeToken + "&source=asfstm";
        debugPrint(tradeUrl);

        let matches = "";
        let any = "";
        let appIdList = [];
        if (bots.Result[index].MatchEverything) {
            any = `&nbsp;<sup><span class="avatar_block_status_in-game" style="font-size: 8px; cursor:help" title="This bots trades for any cards within same set">&nbsp;ANY&nbsp;</span></sup>`;
        }
        for (let i = 0; i < itemsToSend.length; i++) {
            let appId = itemsToSend[i].appId;
            appIdList.push(appId);
            let itemToReceive = itemsToReceive.find((a) => a.appId == appId);
            let gameName = itemsToSend[i].title;
            let display = "inline-block";

            //remove placeholder
            let filterWidget = document.getElementById("asf_stm_filters_body");
            let placeholder = document.getElementById("asf_stm_placeholder");
            if (placeholder !== null) {
                placeholder.parentNode.removeChild(placeholder);
            }
            //add filter
            let checkBox = document.getElementById("astm_" + appId);
            if (checkBox === null) {
                let newFilter = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" /><label for="astm_${appId}">${gameName}</label></span>`;
                let spanTemplate = document.createElement("template");
                spanTemplate.innerHTML = newFilter.trim();
                filterWidget.appendChild(spanTemplate.content.firstChild);
                tradeParams.filter.push(Number(appId));
                SaveParams();
            } else {
                if (checkBox.checked === false) {
                    display = "none";
                }
            }

            let sendResult = populateCards(itemsToSend[i]);
            let receiveResult = populateCards(itemToReceive);

            let tradeUrlApp = tradeUrl + "&match=" + appId;

            let matchTemplate = `
                  <div class="asf_stm_appid_${appId}" style="display:${display}">
                    <div class="badge_row is_link goo_untradable_note showcase_slot">
                      <div class="notLoggedInText">
                        <div title="View badge progress for this game">
                          <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${myProfileLink}/gamecards/${appId}/">
                            <img style="background-color: var(--gpStoreDarkerGrey);" height=69 alt="${gameName}" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg"
                            onerror="this.onerror=null;this.src='https://store.akamai.steamstatic.com/public/images/gift/steam_logo_digitalgiftcard.png'">
                            <div>${gameName}</div>
                          </a>
                        </div>
                        <div class="btn_darkblue_white_innerfade btn_medium">
                          <span>
                            <a href="${tradeUrlApp}" target="_blank" rel="noopener noreferrer">Offer a trade</a>
                          </span>
                        </div>
                      </div>
                      <div class="showcase_slot">
                          <div class="showcase_slot profile_header">
                              <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_in-game badge_info_title badge_row_overlay" style="height: 15px;">You</div>
                              ${sendResult}
                          </div>
                          <span class="showcase_slot badge_info_title booster_creator_actions">
                              <h1>&#10145;</h1>
                          </span>
                      </div>
                      <div class="showcase_slot profile_header">
                          <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_online badge_info_title badge_row_overlay ellipsis" style="height: 15px;">
                            ${bots.Result[index].Nickname}
                          </div>
                        ${receiveResult}
                      </div>
                    </div>
                  </div>
            `;
            if (checkBox === null || checkBox.checked) {
                matches += matchTemplate;
            }
        }
        let tradeUrlFull = tradeUrl + "&match=all";
        let rowTemplate = `
            <div id="asfstmbot_${index}" class="badge_row">
              <div class="badge_row_inner">
                <div class="badge_title_row guide_showcase_contributors">
                  <div class="badge_title_stats">
                    <div class="btn_darkblue_white_innerfade btn_medium">
                      <span>
                        <a class="filter_all" name="${appIdList.join()}" target="_blank" rel="noopener noreferrer" >Filter All</a>
                      </span>
                    </div>
                    <div class="btn_darkblue_white_innerfade btn_medium">
                      <span>
                        <a class="full_trade_url" href="${tradeUrlFull}" target="_blank" rel="noopener noreferrer" >Offer a trade for all</a>
                      </span>
                    </div>
                  </div>
                  <div style="float: left;" class="">
                    <div class="user_avatar playerAvatar online">
                      <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/profiles/${bots.Result[index].SteamID}">
                        <img src="https://avatars.cloudflare.steamstatic.com/${bots.Result[index].AvatarHash === null ? "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb" : bots.Result[index].AvatarHash}.jpg" />
                      </a>
                     </div>
                  </div>
                  <div class="badge_title">
                    &nbsp;<a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/profiles/${bots.Result[index].SteamID}">${bots.Result[index].Nickname}</a>${any}
                    &ensp;<span style="color: #8F98A0;">(${bots.Result[index].TotalInventoryCount} items)</span>
                    &ensp;<a id="blacklist_${bots.Result[index].SteamID}" data-tooltip-text="Blacklist this bot"  class="tooltip hover_tooltip"><img
                    src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconForumBan.png?v=1"></a>
                  </div>
                </div>
                <div class="badge_title_rule"></div>
                ${matches}
              </div>
            </div>
        `;
        let template = document.createElement("template");
        template.innerHTML = rowTemplate.trim();
        let mainContentDiv = document.getElementsByClassName("maincontent")[0];
        let newChild = template.content.firstChild;
        newChild.querySelector(`#blacklist_${bots.Result[index].SteamID}`).addEventListener("click", blacklistEventHandler, true);
        newChild.querySelector(".filter_all").parentNode.addEventListener("click", filterAllEventHandler);
        mainContentDiv.appendChild(newChild);
        checkRow(newChild);
    }

    function calcState(badge) {
        //state 0 - less than max sets; state 1 - we have max sets, even out the rest, state 2 - all even
        debugPrint("maxSets=" + badge.maxSets + " LastSet=" + badge.lastSet + " Max cards=" + badge.cards[badge.maxCards - 1].count + " Min cards=" + badge.cards[0].count);
        if (badge.cards[badge.maxCards - 1].count === badge.maxSets) {
            if (badge.cards[0].count === badge.lastSet) {
                return 2; //nothing to do
            } else {
                return 1; //max sets are here, but we can distribute cards further
            }
        } else {
            return 0; //less than max sets
        }
    }

    function storeMatches(steamID, itemsToSend, itemsToReceive) {
        let partner = getPartner(steamID);
        tradeParams.matches[partner] = {};
        for (let i = 0; i < itemsToSend.length; i++) {
            if (tradeParams.matches[partner][itemsToSend[i].appId] === undefined) {
                tradeParams.matches[partner][itemsToSend[i].appId] = { send: [], receive: [] };
            }
            for (let c = 0; c < itemsToSend[i].cards.length; c++) {
                for (let a = 0; a < itemsToSend[i].cards[c].count; a++) {
                    let cardID = tradeParams.cardNames.indexOf(itemsToSend[i].cards[c].hash);
                    tradeParams.matches[partner][itemsToSend[i].appId].send.push(cardID);
                }
            }
        }
        for (let i = 0; i < itemsToReceive.length; i++) {
            if (tradeParams.matches[partner][itemsToReceive[i].appId] === undefined) {
                throw new Error("Sent and received appIDs don't match!");
            }
            for (let c = 0; c < itemsToReceive[i].cards.length; c++) {
                for (let a = 0; a < itemsToReceive[i].cards[c].count; a++) {
                    let cardID = tradeParams.cardNames.indexOf(itemsToReceive[i].cards[c].hash);
                    tradeParams.matches[partner][itemsToReceive[i].appId].receive.push(cardID);
                }
            }
            if (tradeParams.matches[partner][itemsToReceive[i].appId].send.length !== tradeParams.matches[partner][itemsToReceive[i].appId].receive.length) {
                throw new Error("Sent and received card count don't match for " + tradeParams.matches[partner][itemsToReceive[i].appId] + " !");
            }
        }
        SaveParams();
    }

    function compareCards(index, callback) {
        let itemsToSend = [];
        let itemsToReceive = [];

        debugPrint("bot's cards");
        debugPrint(JSON.stringify(botBadges));
        debugPrint("our cards");
        debugPrint(JSON.stringify(myBadges));

        for (let i = 0; i < botBadges.length; i++) {
            let myBadge = deepClone(myBadges[i]);
            let theirBadge = deepClone(botBadges[i]);
            let myState = calcState(myBadge);
            debugPrint("state=" + myState);
            debugPrint("myapp=" + myBadge.appId + " botapp=" + theirBadge.appId);
            while (myState < 2) {
                let foundMatch = false;
                for (let j = 0; j < theirBadge.maxCards; j++) {
                    //index of card they give
                    if (theirBadge.cards[j].count > 0) {
                        //try to match
                        let myInd = myBadge.cards.findIndex((a) => a.number === theirBadge.cards[j].number); //index of slot where we receive card
                        if ((myState === 0 && myBadge.cards[myInd].count < myBadge.maxSets) || (myState === 1 && myBadge.cards[myInd].count < myBadge.lastSet)) {
                            //we need this ^Kfor the Emperor
                            debugPrint("we need this: " + theirBadge.cards[j].item + " (" + theirBadge.cards[j].count + ")");
                            //find a card to match.
                            for (let k = 0; k < myInd; k++) {
                                //index of card we give
                                debugPrint("i=" + i + " j=" + j + " k=" + k + " myState=" + myState);
                                debugPrint("we have this: " + myBadge.cards[k].item + " (" + myBadge.cards[k].count + ")");
                                if ((myState === 0 && myBadge.cards[k].count > myBadge.maxSets) || (myState === 1 && myBadge.cards[k].count > myBadge.lastSet)) {
                                    //that's fine for us
                                    debugPrint("it's a good trade for us");
                                    let theirInd = theirBadge.cards.findIndex((a) => a.number === myBadge.cards[k].number); //index of slot where they will receive card
                                    if (!bots.Result[index].MatchEverything) {
                                        //make sure it's neutral+ for them
                                        if (theirBadge.cards[theirInd].count >= theirBadge.cards[j].count) {
                                            debugPrint("Not fair for them");
                                            debugPrint("they have this: " + theirBadge.cards[theirInd].item + " (" + theirBadge.cards[theirInd].count + ")");
                                            continue; //it's not neutral+, check other options
                                        }
                                    }
                                    debugPrint("it's a match!");
                                    let itemToSend = {
                                        item: myBadge.cards[k].item,
                                        count: 1,
                                        iconUrl: myBadge.cards[k].iconUrl,
                                        hash: myBadge.cards[k].hash,
                                    };
                                    let itemToReceive = {
                                        item: theirBadge.cards[j].item,
                                        count: 1,
                                        iconUrl: theirBadge.cards[j].iconUrl,
                                        hash: theirBadge.cards[j].hash,
                                    };
                                    //fill items to send
                                    let sendmatch = itemsToSend.find((item) => item.appId == myBadge.appId);
                                    if (sendmatch === undefined) {
                                        let newMatch = {
                                            appId: myBadge.appId,
                                            title: myBadge.title,
                                            cards: [itemToSend],
                                        };
                                        itemsToSend.push(newMatch);
                                    } else {
                                        let existingCard = sendmatch.cards.find((a) => a.hash === itemToSend.hash);
                                        if (existingCard === undefined) {
                                            sendmatch.cards.push(itemToSend);
                                        } else {
                                            existingCard.count += 1;
                                        }
                                    }
                                    //add this item to their inventory
                                    theirBadge.cards[theirInd].count += 1;
                                    //remove this item from our inventory
                                    myBadge.cards[k].count -= 1;

                                    //fill items to receive
                                    let receiveMatch = itemsToReceive.find((item) => item.appId == myBadge.appId);
                                    if (receiveMatch === undefined) {
                                        let newMatch = {
                                            appId: myBadge.appId,
                                            title: myBadge.title,
                                            cards: [itemToReceive],
                                        };
                                        itemsToReceive.push(newMatch);
                                    } else {
                                        let existingCard = receiveMatch.cards.find((a) => a.hash === itemToReceive.hash);
                                        if (existingCard === undefined) {
                                            receiveMatch.cards.push(itemToReceive);
                                        } else {
                                            existingCard.count += 1;
                                        }
                                    }
                                    //add this item to our inventory
                                    myBadge.cards[myInd].count += 1;
                                    //remove this item from their inventory
                                    theirBadge.cards[j].count -= 1;
                                    foundMatch = true;
                                    break; //found a match!
                                }
                            }
                            if (foundMatch) {
                                //if we found something - we need to sort cards again and start over.
                                myBadge.cards.sort((a, b) => b.count - a.count);
                                myState = calcState(myBadge);
                                debugPrint("new myState=" + myState);
                            }
                        }
                    }
                }
                if (!foundMatch) {
                    break; //found no matches - move to next badge
                }
                theirBadge.cards.sort((a, b) => b.count - a.count);
            }
        }

        debugPrint("items to send");
        debugPrint(JSON.stringify(itemsToSend));
        debugPrint("items to receive");
        debugPrint(JSON.stringify(itemsToReceive));
        bots.Result[index].itemsToSend = itemsToSend;
        bots.Result[index].itemsToReceive = itemsToReceive;
        if (itemsToSend.length > 0) {
            storeMatches(bots.Result[index].SteamID, itemsToSend, itemsToReceive);
            addMatchRow(index);
            callback();
        } else {
            debugPrint("no matches");
            callback();
        }
    }

    function GetOwnCards(index) {
        debugPrint("GetOwnCards " + index);

        if (index === 0) {
            for (let i = 0; i < myBadges.length; i++) {
                myBadges[i].cards.length = 0;
            }
        }
        if (index < myBadges.length) {
            let profileLink;
            profileLink = myProfileLink;
            updateMessage("Getting our data for badge " + (index + 1) + " of " + myBadges.length);
            updateProgress(index, myBadges.length);

            let url = "https://steamcommunity.com/" + profileLink + "/ajaxgetbadgeinfo/" + myBadges[index].appId;
            let xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "json";
            // eslint-disable-next-line
            xhr.onload = function () {
                if (stop) {
                    updateMessage("Interrupted by user");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
                let status = xhr.status;
                if (status === 200) {
                    try {
                        debugPrint("processing badge " + myBadges[index].appId);
                        if (xhr.response != undefined && xhr.response.eresult == 1) {
                            if (xhr.response.badgedata.rgCards.length >= 5) {
                                errors = 0;
                                myBadges[index].maxCards = xhr.response.badgedata.rgCards.length;
                                for (let i = 0; i < myBadges[index].maxCards; i++) {
                                    let newcard = {
                                        item: xhr.response.badgedata.rgCards[i].title,
                                        hash: xhr.response.badgedata.rgCards[i].markethash,
                                        count: xhr.response.badgedata.rgCards[i].owned,
                                        iconUrl: xhr.response.badgedata.rgCards[i].imgurl,
                                        number: i,
                                    };
                                    debugPrint(JSON.stringify(newcard));
                                    myBadges[index].cards.push(newcard);
                                    cardNames.add(xhr.response.badgedata.rgCards[i].markethash);
                                }

                                index++;
                                setTimeout(
                                    (function (index) {
                                        return function () {
                                            GetOwnCards(index);
                                        };
                                    })(index),
                                    globalSettings.weblimiter,
                                );
                                return;
                            } else {
                                debugPrint("less than 5 cards in a badge - something is wrong");
                                debugPrint(JSON.stringify(xhr.response));
                                errors++;
                            }
                        } else {
                            updateMessage("Error getting own badge data, badge: " + myBadges[index].appId);
                            if (xhr.response != undefined) {
                                debugPrint("eresult = " + xhr.response.eresult);
                            }
                            hideThrobber();
                            enableButton();
                            let stopButton = document.getElementById("asf_stm_stop");
                            stopButton.parentNode.removeChild(stopButton);
                            return;
                        }
                    } catch (error) {
                        debugPrint(error);
                        debugPrint(JSON.stringify(xhr.response));
                        errors++;
                    }
                } else {
                    errors++;
                }
                if ((status < 400 || status >= 500) && errors <= globalSettings.maxErrors) {
                    setTimeout(
                        (function (index) {
                            return function () {
                                GetOwnCards(index);
                            };
                        })(index),
                        globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                    );
                } else {
                    if (status !== 200) {
                        updateMessage("Error getting badge data, ERROR " + status);
                    } else {
                        debugPrint("Error getting own badge data, wrong badge " + myBadges[index].appId);
                        setTimeout(
                            (function (index) {
                                return function () {
                                    GetOwnCards(index);
                                };
                            })(index),
                            globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                        );
                    }
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
            };
            // eslint-disable-next-line
            xhr.onerror = function () {
                if (stop) {
                    updateMessage("Interrupted by user");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
                errors++;
                if (errors <= globalSettings.maxErrors) {
                    setTimeout(
                        (function (index) {
                            return function () {
                                GetOwnCards(index);
                            };
                        })(index),
                        globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                    );
                    return;
                } else {
                    debugPrint("error");
                    updateMessage("Error getting badge data");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
            };
            xhr.send();
            return; //do this synchronously to avoid rate limit
        }
        debugPrint("populated");

        debugTime("Filter and sort");
        for (let i = myBadges.length - 1; i >= 0; i--) {
            debugPrint("badge " + i + JSON.stringify(myBadges[i]));

            myBadges[i].cards.sort((a, b) => b.count - a.count);
            if (myBadges[i].cards[0].count - myBadges[i].cards[myBadges[i].cards.length - 1].count < 2) {
                //nothing to match, remove from list.
                myBadges.splice(i, 1);
                continue;
            }

            let totalCards = 0;
            for (let j = 0; j < myBadges[i].maxCards; j++) {
                totalCards += myBadges[i].cards[j].count;
            }
            myBadges[i].maxSets = Math.floor(totalCards / myBadges[i].maxCards);
            myBadges[i].lastSet = Math.ceil(totalCards / myBadges[i].maxCards);
            debugPrint("totalCards=" + totalCards + " maxSets=" + myBadges[i].maxSets + " lastSet=" + myBadges[i].lastSet);
        }
        debugTimeEnd("Filter and sort");

        if (myBadges.length === 0) {
            hideThrobber();
            updateMessage("No cards to match");
            enableButton();
            let stopButton = document.getElementById("asf_stm_stop");
            stopButton.parentNode.removeChild(stopButton);
            return;
        } else {
            SaveParams();
            GetCards(0, 0);
            return;
        }
    }

    function GetCards(index, userindex, idLink) {
        debugPrint("GetCards " + index + " : " + userindex);

        if (userindex >= bots.Result.length) {
            debugPrint("finished");
            debugPrint(new Date(Date.now()));
            hideThrobber();
            hideMessage();
            updateProgress(1, 1); // limit reached, fill the bar
            enableButton();
            let stopButton = document.getElementById("asf_stm_stop");
            stopButton.parentNode.removeChild(stopButton);
            return;
        }

        if (
            (bots.Result[userindex].MatchEverything && !globalSettings.anyBots) ||
            (!bots.Result[userindex].MatchEverything && !globalSettings.fairBots) ||
            bots.Result[userindex].TotalInventoryCount < globalSettings.botMinItems ||
            (globalSettings.botMaxItems > 0 && bots.Result[userindex].TotalInventoryCount > globalSettings.botMaxItems) ||
            blacklist.includes(bots.Result[userindex].SteamID) ||
            !bots.Result[userindex].MatchableTypes.includes(5)
        ) {
            debugPrint("Ignoring bot " + bots.Result[userindex].SteamID);
            debugPrint(bots.Result[userindex].MatchEverything && !globalSettings.anyBots);
            debugPrint(!bots.Result[userindex].MatchEverything && !globalSettings.fairBots);
            debugPrint(bots.Result[userindex].TotalInventoryCount >= globalSettings.botMinItems);
            debugPrint(globalSettings.botMaxItems > 0 && bots.Result[userindex].TotalInventoryCount <= globalSettings.botMaxItems);
            debugPrint(blacklist.includes(bots.Result[userindex].SteamID));
            debugPrint(bots.Result[userindex].MatchableTypes);
            GetCards(0, userindex + 1);
            return;
        }

        if (index === 0) {
            botBadges.length = 0;
            botBadges = deepClone(myBadges);
            for (let i = 0; i < botBadges.length; i++) {
                botBadges[i].cards.length = 0;
            }
        }
        if (index < botBadges.length) {
            let profileLink = idLink || "profiles/" + bots.Result[userindex].SteamID;
            updateMessage("Fetching bot " + (userindex + 1).toString() + " of " + bots.Result.length.toString() + " (badge " + (index + 1) + " of " + botBadges.length + ")");
            updateProgress(userindex, bots.Result.length);

            let url = "https://steamcommunity.com/" + profileLink + "/gamecards/" + botBadges[index].appId;
            let xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "document";
            // eslint-disable-next-line
            xhr.onload = function () {
                if (stop) {
                    updateMessage("Interrupted by user");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
                let status = xhr.status;
                if (status === 200) {
                    debugPrint("processing badge " + botBadges[index].appId);
                    if (null !== xhr.response.documentElement.querySelector("body.private_profile")) {
                        debugPrint("bot has private profile:" + bots.Result[userindex].SteamID);
                        setTimeout(
                            (function (index, userindex) {
                                return function () {
                                    GetCards(index, userindex);
                                };
                            })(0, userindex + 1),
                            globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                        );
                        return;
                    }
                    let badgeCards = xhr.response.documentElement.querySelectorAll(".badge_card_set_card");
                    if (badgeCards.length >= 5) {
                        errors = 0;
                        botBadges[index].maxCards = badgeCards.length;
                        for (let i = 0; i < badgeCards.length; i++) {
                            let quantityElement = badgeCards[i].querySelector(".badge_card_set_text_qty");
                            let quantity = quantityElement === null ? "(0)" : quantityElement.innerText.trim();
                            quantity = quantity.slice(1, -1);
                            let name = "";
                            badgeCards[i].querySelector(".badge_card_set_title").childNodes.forEach(function (element) {
                                if (element.nodeType === Node.TEXT_NODE) {
                                    name = name + element.textContent;
                                }
                            });
                            name = name.trim();
                            let markethash = myBadges[index].cards.find((card) => card.number === i).hash;
                            let icon = badgeCards[i].querySelector(".gamecard").src.trim();
                            let newcard = {
                                item: name,
                                hash: markethash,
                                count: Number(quantity),
                                iconUrl: icon,
                                number: i,
                            };
                            debugPrint(JSON.stringify(newcard));
                            botBadges[index].cards.push(newcard);
                        }

                        if (!idLink) {
                            const idMatch = xhr.responseURL.match(/(id\/.+?)\//);
                            if (idMatch && idMatch[1]) {
                                idLink = idMatch[1];
                            }
                        }
                        index++;
                        setTimeout(
                            (function (index, userindex, idLink) {
                                return function () {
                                    GetCards(index, userindex, idLink);
                                };
                            })(index, userindex, idLink),
                            globalSettings.weblimiter,
                        );
                        return;
                    } else {
                        //if can't find any cards on badge page - retry, that's must be a bug.
                        debugPrint(xhr.response.documentElement.outerHTML);
                        errors++;
                    }
                } else {
                    errors++;
                }
                if ((status < 400 || status >= 500) && errors <= globalSettings.maxErrors) {
                    setTimeout(
                        (function (index, userindex, idLink) {
                            return function () {
                                GetCards(index, userindex, idLink);
                            };
                        })(index, userindex, idLink),
                        globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                    );
                } else {
                    if (status !== 200) {
                        updateMessage("Error getting badge data, ERROR " + status);
                    } else {
                        debugPrint("Error getting badge data, malformed HTML. Ignoring badge " + botBadges[index].appId);
                        setTimeout(
                            (function (index, userindex, idLink) {
                                return function () {
                                    GetCards(index, userindex, idLink);
                                };
                            })(index, userindex, idLink),
                            globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                        );
                    }
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
            };
            // eslint-disable-next-line
            xhr.onerror = function () {
                if (stop) {
                    updateMessage("Interrupted by user");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
                errors++;
                if (errors <= globalSettings.maxErrors) {
                    setTimeout(
                        (function (index, userindex, idLink) {
                            return function () {
                                GetCards(index, userindex, idLink);
                            };
                        })(index, userindex, idLink),
                        globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                    );
                    return;
                } else {
                    debugPrint("error");
                    updateMessage("Error getting badge data");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.parentNode.removeChild(stopButton);
                    return;
                }
            };
            xhr.send();
            return; //do this synchronously to avoid rate limit
        }
        debugPrint("populated");

        debugTime("Filter and sort");
        for (let i = botBadges.length - 1; i >= 0; i--) {
            debugPrint("badge " + i + JSON.stringify(botBadges[i]));

            botBadges[i].cards.sort((a, b) => b.count - a.count);
            let totalCards = 0;
            for (let j = 0; j < botBadges[i].maxCards; j++) {
                totalCards += botBadges[i].cards[j].count;
            }
            botBadges[i].maxSets = Math.floor(totalCards / botBadges[i].maxCards);
            botBadges[i].lastSet = Math.ceil(totalCards / botBadges[i].maxCards);
            debugPrint("totalCards=" + totalCards + " maxSets=" + botBadges[i].maxSets + " lastSet=" + botBadges[i].lastSet);
        }
        debugTimeEnd("Filter and sort");

        debugPrint(bots.Result[userindex].SteamID);
        compareCards(userindex, function () {
            setTimeout(
                (function (userindex) {
                    return function () {
                        GetCards(0, userindex);
                    };
                })(userindex + 1),
                globalSettings.weblimiter,
            );
        });
    }

    function getBadges(page) {
        let url = "https://steamcommunity.com/" + myProfileLink + "/badges?p=" + page;
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "document";
        xhr.onload = function () {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.parentNode.removeChild(stopButton);
                return;
            }
            let status = xhr.status;
            if (status === 200) {
                errors = 0;
                debugPrint("processing page " + page);
                updateMessage("Processing badges page " + page);
                if (page === 1) {
                    let pageLinks = xhr.response.documentElement.getElementsByClassName("pagelink");
                    if (pageLinks.length > 0) {
                        maxPages = Number(pageLinks[pageLinks.length - 1].textContent.trim());
                    }
                }
                updateProgress(page - 1, maxPages); // substract 1 from page number as it starts from 1
                let badges = xhr.response.documentElement.getElementsByClassName("badge_row_inner");
                for (let i = 0; i < badges.length; i++) {
                    if (badges[i].getElementsByClassName("owned").length > 0) {
                        //we only need badges where we have at least one card, and no special badges
                        if (!badges[i].parentElement.querySelector(".badge_row_overlay").href.endsWith("border=1")) {
                            //ignore foil badges completely for now. TODO: match foils too.
                            let appidNodes = badges[i].getElementsByClassName("card_drop_info_dialog");
                            if (appidNodes.length > 0) {
                                let appidText = appidNodes[0].getAttribute("id");
                                let appidSplitted = appidText.split("_");
                                if (appidSplitted.length >= 5) {
                                    let appId = Number(appidSplitted[4]);
                                    let maxCards = 0;
                                    if (badges[i].getElementsByClassName("badge_craft_button").length === 0) {
                                        let maxCardsText = badges[i].getElementsByClassName("badge_progress_info")[0].innerText.trim();
                                        let maxCardsSplitted = maxCardsText.split(" ");
                                        maxCards = Number(maxCardsSplitted[2]);
                                    }
                                    let title = badges[i].querySelector(".badge_title").childNodes[0].textContent.trim();
                                    let badgeStub = {
                                        appId: appId,
                                        title: title,
                                        maxCards: maxCards,
                                        maxSets: 0,
                                        lastSet: 0,
                                        cards: [],
                                    };
                                    myBadges.push(badgeStub);
                                }
                            }
                        }
                    }
                }
                page++;
            } else {
                errors++;
            }
            if ((status < 400 || status >= 500) && errors <= globalSettings.maxErrors) {
                if (page <= maxPages) {
                    setTimeout(
                        (function (page) {
                            return function () {
                                getBadges(page);
                            };
                        })(page),
                        globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                    );
                } else {
                    debugPrint("all badge pages processed");
                    debugPrint(globalSettings.weblimiter + globalSettings.errorLimiter * errors);
                    if (myBadges.length === 0) {
                        hideThrobber();
                        updateMessage("No cards to match");
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.parentNode.removeChild(stopButton);
                        return;
                    } else {
                        setTimeout(
                            function () {
                                GetOwnCards(0);
                            },
                            globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                        );
                    }
                }
            } else {
                if (status !== 200) {
                    updateMessage("Error getting badge page, ERROR " + status);
                } else {
                    updateMessage("Error getting badge page, malformed HTML");
                }
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.parentNode.removeChild(stopButton);
                return;
            }
        };
        xhr.onerror = function () {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.parentNode.removeChild(stopButton);
                return;
            }
            errors++;
            if (errors <= globalSettings.maxErrors) {
                setTimeout(
                    (function (page) {
                        return function () {
                            getBadges(page);
                        };
                    })(page),
                    globalSettings.weblimiter + globalSettings.errorLimiter * errors,
                );
            } else {
                debugPrint("error getting badge page");
                updateMessage("Error getting badge page");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.parentNode.removeChild(stopButton);
                return;
            }
        };
        xhr.send();
    }

    function filterEventHandler(event) {
        let appId = event.target.id.split("_")[1];
        let matches = document.getElementsByClassName("asf_stm_appid_" + appId);
        for (let i = 0; i < matches.length; i++) {
            if (event.target.checked) {
                matches[i].style.display = "inline-block";
                if (!tradeParams.filter.includes(Number(appId))) {
                    tradeParams.filter.push(Number(appId));
                }
            } else {
                matches[i].style.display = event.target.checked ? "inline-block" : "none";
                let index = tradeParams.filter.indexOf(Number(appId));
                if (index !== -1) {
                    tradeParams.filter.splice(index, 1);
                }
            }
            checkRow(matches[i].parentElement.parentElement);
        }
        SaveParams();
    }

    function filterSwitchesHandler(event) {
        let action = event.target.id.split("_")[3];
        let filterWidget = document.getElementById("asf_stm_filters_body");
        let checkboxes = filterWidget.getElementsByTagName("input");
        for (let i = 0; i < checkboxes.length; i++) {
            if (action === "all") {
                if (!checkboxes[i].checked) {
                    checkboxes[i].checked = true;
                    filterEventHandler({ target: checkboxes[i] });
                }
            } else if (action === "none") {
                if (checkboxes[i].checked) {
                    checkboxes[i].checked = false;
                    filterEventHandler({ target: checkboxes[i] });
                }
            } else if (action === "invert") {
                checkboxes[i].checked = !checkboxes[i].checked;
                filterEventHandler({ target: checkboxes[i] });
            }
        }
    }

    function filtersButtonEvent() {
        let filterWidget = document.getElementById("asf_stm_filters");
        if (filterWidget.style.marginRight === "-50%") {
            filterWidget.style.marginRight = "unset";
        } else {
            filterWidget.style.marginRight = "-50%";
        }
    }

    function stopButtonEvent() {
        let stopButton = document.getElementById("asf_stm_stop");
        stopButton.removeEventListener("click", stopButtonEvent, false);
        stopButton.title = "Stopping...";
        stopButton.classList.add("btn_disabled");
        updateMessage("Stopping...");
        stop = true;
    }

    function buttonPressedEvent() {
        if (bots === null || bots.Result === undefined || bots.Result.length === 0 || bots.Success !== true || bots.cacheTime + botCacheTime < Date.now()) {
            debugPrint("Bot cache invalidated");
            fetchBots();
            return;
        }
        bots.Result.sort(botSorter);
        disableButton();
        debugPrint(new Date(Date.now()));
        let mainContentDiv = document.getElementsByClassName("maincontent")[0];
        mainContentDiv.textContent = "";
        mainContentDiv.style.width = "90%";
        mainContentDiv.innerHTML = `
          <div class="profile_badges_header">
            <div id="throbber">
                <div class="LoadingWrapper">
                    <div class="LoadingThrobber">
                        <div class="Bar Bar1"></div>
                        <div class="Bar Bar2"></div>
                        <div class="Bar Bar3"></div>
                    </div>
                </div>
            </div>
            <div>
            <div id="asf_stm_messagebox" class="profile_badges_header">
               <div id="asf_stm_message" class="profile_badges_header_title" style="text-align: center;">Initialization</div>
            </div>
            </div>
            <div style="width: 100%;">
              <div id="asf_stm_stop" class="btn_darkred_white_innerfade btn_medium_thin" style="float: right;margin-top: -12px;margin-left: 10px;" title="Stop scan">
                <span>🛑</span>
              </div>
              <div style="width: auto;overflow: hidden;" class="profile_xp_block_remaining_bar">
                <div id="asf_stm_progress" class="profile_xp_block_remaining_bar_progress" style="width: 100%;transition: width 0.5s ease-in-out 0s">
                </div>
              </div>
            </div>
          </div>
          <div id="asf_stm_filters" style="position: fixed; z-index: 1000; right: 5px; bottom: 45px; transition-duration: 500ms;
                   transition-timing-function: ease; margin-right: -50%; padding: 5px; max-width: 40%; display: inline-block; border-radius: 2px;
                   background:${globalSettings.filterBackgroundColor}; color: #67c1f5;">
              <div style="white-space: nowrap;">Select:
	          <a id="asf_stm_filter_all" class="commentthread_pagelinks">
		        all
	          </a>
	          <a id="asf_stm_filter_none" class="commentthread_pagelinks">
		        none
	          </a>
	          <a id="asf_stm_filter_invert" class="commentthread_pagelinks">
		        invert
	          </a>
            </div>
            <hr />
            <div id="asf_stm_filters_body">
              <span id="asf_stm_placeholder" style="margin-right: 15px;">No matches to filter</span>
            </div>
          </div>
          <div style="position: fixed;z-index: 1000;right: 5px;bottom: 5px;" id="asf_stm_filters_button_div">
              <a id="asf_stm_filters_button" class="btnv6_blue_hoverfade btn_medium">
                  <span>Filters</span>
              </a>
          </div>
        `;
        document.getElementById("asf_stm_stop").addEventListener("click", stopButtonEvent, false);
        document.getElementById("asf_stm_filters_body").addEventListener("change", filterEventHandler);
        document.getElementById("asf_stm_filter_all").addEventListener("click", filterSwitchesHandler);
        document.getElementById("asf_stm_filter_none").addEventListener("click", filterSwitchesHandler);
        document.getElementById("asf_stm_filter_invert").addEventListener("click", filterSwitchesHandler);
        document.getElementById("asf_stm_filters_button").addEventListener("click", filtersButtonEvent, false);
        maxPages = 1;
        stop = false;
        myBadges.length = 0;
        cardNames = new Set();
        tradeParams = {
            matches: {},
            filter: [],
        };
        getBadges(1);
    }

    function botSorter(a, b) {
        let result = 0;
        for (let i = 0; i < globalSettings.sortBotsBy.length; i++) {
            switch (globalSettings.sortBotsBy[i]) {
                case "MatchEverythingFirst":
                    result = b.MatchEverything - a.MatchEverything;
                    break;
                case "MatchEverythingLast":
                    result = a.MatchEverything - b.MatchEverything;
                    break;
                case "TotalGamesCountDesc":
                    result = b.TotalGamesCount - a.TotalGamesCount;
                    break;
                case "TotalGamesCountAsc":
                    result = a.TotalGamesCount - b.TotalGamesCount;
                    break;
                case "TotalItemsCountDesc":
                    result = b.TotalItemsCount - a.TotalItemsCount;
                    break;
                case "TotalItemsCountAsc":
                    result = a.TotalItemsCount - b.TotalItemsCount;
                    break;
                case "TotalInventoryCountDesc":
                    result = b.TotalInventoryCount - a.TotalInventoryCount;
                    break;
                case "TotalInventoryCountAsc":
                    result = a.TotalInventoryCount - b.TotalInventoryCount;
                    break;
            }
            if (result !== 0) {
                break;
            }
        }
        return result;
    }

    function fetchBots() {
        let requestUrl = "https://asf.justarchi.net/Api/Listing/Bots";
        let requestFunc;
        if (typeof GM_xmlhttpRequest !== "function") {
            requestFunc = GM.xmlHttpRequest.bind(GM);
        } else {
            requestFunc = GM_xmlhttpRequest;
        }
        requestFunc({
            method: "GET",
            url: requestUrl,
            headers: {
                "User-Agent": "ASF-STM/" + GM_info.version,
            },
            onload: function (response) {
                if (response.status !== 200) {
                    disableButton();
                    document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots");
                    debugPrint("can't fetch list of bots, ERROR=" + response.status);
                    debugPrint(JSON.stringify(response));
                    return;
                }
                try {
                    let re = /("SteamID":)(\d+)/g;
                    let fixedJson = response.response.replace(re, '$1"$2"'); //because fuck js
                    bots = JSON.parse(fixedJson);
                    bots.cacheTime = Date.now();
                    if (bots.Success) {
                        debugPrint("found total " + bots.Result.length + " bots");
                        localStorage.setItem("Ryzhehvost.ASF.STM.BotCache", JSON.stringify(bots));
                        buttonPressedEvent();
                    } else {
                        //ASF backend does not indicate success
                        disableButton();
                        document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots, try later");
                        debugPrint("can't fetch list of bots");
                        debugPrint(bots.Message);
                        debugPrint(JSON.stringify(response));
                        return;
                    }
                    return;
                } catch (e) {
                    disableButton();
                    document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots, try later");
                    debugPrint("can't fetch list of bots");
                    debugPrint(e);
                    debugPrint(JSON.stringify(response));
                    return;
                }
            },
            onerror: function (response) {
                disableButton();
                document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots");
                debugPrint("can't fetch list of bots");
                debugPrint(JSON.stringify(response));
            },
            onabort: function (response) {
                disableButton();
                document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots");
                debugPrint("can't fetch list of bots - aborted");
                debugPrint(JSON.stringify(response));
            },
            ontimeout: function (response) {
                disableButton();
                document.getElementById("asf_stm_button_div").setAttribute("title", "Can't fetch list of bots");
                debugPrint("can't fetch list of bots - timeout");
                debugPrint(JSON.stringify(response));
            },
        });
    }
    //Main
    LoadConfig();
    localStorage.removeItem("Ryzhehvost.ASF.STM"); //we used to store classid database here before, clean this up.
    if (document.getElementsByClassName("badge_details_set_favorite").length !== 0) {
        let profileRegex = /http[s]?:\/\/steamcommunity.com\/(.*)\/badges.*/g;
        let result = profileRegex.exec(document.location);
        if (result) {
            myProfileLink = result[1];
        } else {
            //should never happen, but whatever.
            myProfileLink = "my";
        }

        debugPrint(profileRegex);

        let botCache = JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM.BotCache"));
        if (botCache === null || botCache.cacheTime === undefined || botCache.cacheTime === null || botCache.cacheTime + botCacheTime < Date.now()) {
            botCache = null;
            debugPrint("Bot cache invalidated");
        } else {
            bots = botCache;
        }

        let buttonDiv = document.createElement("div");
        buttonDiv.setAttribute("class", "profile_small_header_additional");
        buttonDiv.setAttribute("style", "margin-top: 40px; right: 70px");
        buttonDiv.setAttribute("id", "asf_stm_button_div");
        buttonDiv.setAttribute("title", "Scan ASF STM");
        let button = document.createElement("a");
        button.setAttribute("class", "btnv6_blue_hoverfade btn_medium");
        button.setAttribute("id", "asf_stm_button");
        button.appendChild(document.createElement("span"));
        button.firstChild.appendChild(document.createTextNode("Scan ASF STM"));
        buttonDiv.appendChild(button);
        let anchor = document.getElementsByClassName("profile_small_header_texture")[0];
        anchor.appendChild(buttonDiv);
        let confButtonDiv = document.createElement("div");
        confButtonDiv.setAttribute("class", "profile_small_header_additional");
        confButtonDiv.setAttribute("style", "margin-top: 40px;");
        confButtonDiv.setAttribute("id", "asf_stm_config_div");
        confButtonDiv.setAttribute("title", "Configuration");
        let confButton = document.createElement("a");
        confButton.setAttribute("class", "btnv6_blue_hoverfade btn_medium_thin");
        confButton.setAttribute("id", "asf_stm_config");
        confButton.appendChild(document.createElement("span"));
        confButton.firstChild.appendChild(document.createTextNode("⚙️"));
        confButtonDiv.appendChild(confButton);
        anchor.appendChild(confButtonDiv);
        confButton.addEventListener("click", ShowConfigDialog, false);

        enableButton();

        // add our styles to the document's style sheet
        if (typeof GM_addStyle !== "undefined") {
            GM_addStyle(css);
        } else {
            const node = document.createElement("style");
            node.appendChild(document.createTextNode(css));
            const heads = document.getElementsByTagName("head");
            if (heads.length > 0) {
                heads[0].appendChild(node);
            } else {
                // no head yet, stick it whereever
                document.documentElement.appendChild(node);
            }
        }
    } else {
        //Code below is a heavily modified version of SteamTrade Matcher Userscript by Tithen-Firion
        //Original can be found on https://github.com/Tithen-Firion/STM-UserScript

        // MIT License
        // Copyright (c) 2017 Tithen-Firion
        // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
        // The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

        function getRandomInt(min, max) {
            "use strict";
            return Math.floor(Math.random() * (max - min)) + min;
        }

        function mySort(a, b) {
            "use strict";
            return parseInt(b.id) - parseInt(a.id);
        }

        ///// Steam functions /////

        function restoreCookie(oldCookie) {
            "use strict";
            if (oldCookie) {
                let now = new Date();
                let time = now.getTime();
                time += 15 * 24 * 60 * 60 * 1000;
                now.setTime(time);
                document.cookie = "strTradeLastInventoryContext=" + oldCookie + "; expires=" + now.toUTCString() + "; path=/tradeoffer/";
            }
        }

        function addCards(g_s, g_v) {
            "use strict";
            let tmpCards, inv, index, currentCards;
            let failLater = false;
            let cardTypes = [[], []];
            g_v.Cards.forEach(function (requestedCards, i) {
                tmpCards = {};
                inv = g_v.Users[i].rgContexts[753][6].inventory;
                inv.BuildInventoryDisplayElements();
                inv = inv.rgInventory;
                Object.keys(inv).forEach(function (item) {
                    // add all matching cards to temporary dict
                    index = requestedCards.findIndex((elem) => elem == inv[item].market_hash_name);
                    if (index > -1) {
                        if (tmpCards[requestedCards[index]] === undefined) {
                            tmpCards[requestedCards[index]] = [];
                        }
                        tmpCards[requestedCards[index]].push({ type: inv[item].type, element: inv[item].element, id: inv[item].id });
                    }
                });
                if (g_s.order === "SORT") {
                    // sort cards descending by card id for each type
                    Object.keys(tmpCards).forEach(function (id) {
                        tmpCards[id].sort(mySort);
                    });
                }
                // add cards to trade in order given by STM
                requestedCards.forEach(function (elem) {
                    currentCards = tmpCards[elem] || []; // all cards from inventory with requested signature
                    if (currentCards.length === 0) {
                        failLater = true;
                    } else {
                        index = 0;
                        if (g_s.order === "RANDOM") {
                            // randomize index
                            index = getRandomInt(0, currentCards.length);
                        }
                        unsafeWindow.MoveItemToTrade(currentCards[index].element);
                        cardTypes[i].push(currentCards[index].type);
                        currentCards.splice(index, 1);
                    }
                });
            });

            if (failLater || document.querySelectorAll("#your_slots .has_item").length !== document.querySelectorAll("#their_slots .has_item").length) {
                unsafeWindow.ShowAlertDialog("Items missing", "Some items are missing and were not added to trade offer. Script aborting.");
                throw "Cards missing";
            }

            // check if item types match
            cardTypes[1].forEach(function (type) {
                index = cardTypes[0].indexOf(type);
                if (index > -1) {
                    cardTypes[0].splice(index, 1);
                } else {
                    unsafeWindow.ShowAlertDialog("Not 1:1 trade", "This is not a valid 1:1 trade. Script aborting.");
                    throw "Not 1:1 trade";
                }
            });
            restoreCookie(g_v.oldCookie);
            // inject some JS to do something after trade offer is sent
            if (g_s.doAfterTrade !== "NOTHING") {
                let functionToInject = 'let doAfterTrade = "' + g_s.doAfterTrade + '";';
                functionToInject += "$J(document).ajaxSuccess(function (event, xhr, settings) {";
                functionToInject += 'if (settings.url === "https://steamcommunity.com/tradeoffer/new/send") {';
                functionToInject += 'if (doAfterTrade === "CLOSE_WINDOW") { window.close();';
                functionToInject += '} else if (doAfterTrade === "CLICK_OK") {';
                functionToInject += 'document.querySelector("div.newmodal_buttons > div").click(); } } });';
                let script = document.createElement("script");
                script.appendChild(document.createTextNode(functionToInject));
                document.body.appendChild(script);
            }
            // send trade offer
            if (g_s.autoSend) {
                unsafeWindow.ToggleReady(true);
                unsafeWindow.CTradeOfferStateManager.ConfirmTradeOffer();
            }

            let notif = document.createElement("span");
            notif.setAttribute("style", "color:#00FF00; opacity:0; transition: opacity 3s;");
            notif.appendChild(document.createTextNode("(All cards added successfully)"));
            let anchor = document.getElementsByClassName("trade_partner_headline")[0];
            anchor.appendChild(notif);
            window.getComputedStyle(notif).opacity;
            notif.style.opacity = 1;
            debugPrint("everything done");
        }

        function checkContexts(g_s, g_v) {
            "use strict";
            let ready = 0;
            // check if Steam loaded everything needed
            g_v.Users.forEach(function (user) {
                if (user.rgContexts && user.rgContexts[753] && user.rgContexts[753][6]) {
                    if (user.cLoadsInFlight === 0) {
                        if (user.rgContexts[753][6].inventory) {
                            ready += 1;
                        } else {
                            unsafeWindow.document.getElementById("trade_inventory_unavailable").show();
                            unsafeWindow.document.getElementById("trade_inventory_pending").show();
                            user.loadInventory(753, 6);
                        }
                    }
                }
            });

            if (ready === 2) {
                // select your inventory
                unsafeWindow.TradePageSelectInventory(g_v.Users[0], 753, "6");
                // set trade offer message
                document.getElementById("trade_offer_note").value = g_s.tradeMessage;
                try {
                    addCards(g_s, g_v);
                } catch (e) {
                    // no matter what happens, restore old cookie
                    restoreCookie(g_v.oldCookie);
                    debugPrint(e);
                }
            } else {
                window.setTimeout(checkContexts, 500, g_s, g_v);
            }
        }

        function getUrlVars() {
            "use strict";
            let vars = {};
            let hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
            hashes.forEach(function (hash) {
                hash = hash.split("=");
                vars[hash[0]] = hash[1];
            });
            return vars;
        }

        ///// STM functions /////

        try {
            if (window.location.href.includes("source=asfstm")) {
                LoadConfig();
                let params = LoadParams();

                let vars = getUrlVars();

                if (vars.match === undefined) {
                    throw new Error("missing url parameter");
                }
                let filter = [];
                if (vars.match === "all") {
                    filter = params.filter;
                } else {
                    if (Number(vars.match) === NaN) {
                        throw new Error("invalid url parameter");
                    }
                    filter.push(Number(vars.match));
                }

                let Cards = [[], []];
                let matches = params.matches[vars.partner];
                if (matches === undefined) {
                    throw new Error("no matches with this partner");
                }
                debugPrint(JSON.stringify(matches));
                for (let i = 0; i < filter.length; i++) {
                    let appid = filter[i];

                    if (matches[appid] === undefined) {
                        //can happen, filter is just allowed appids, not necessaryly available on this bot.
                        debugPrint("no such appid in matches: " + appid);
                    } else {
                        debugPrint("adding matches for appid: " + appid);
                        Cards[0] = Cards[0].concat(matches[appid].send.map((card) => decodeURIComponent(params.cardNames[card])));
                        Cards[1] = Cards[1].concat(matches[appid].receive.map((card) => decodeURIComponent(params.cardNames[card])));
                    }
                }
                debugPrint(JSON.stringify(Cards));

                if (Cards[0].length !== Cards[1].length) {
                    unsafeWindow.ShowAlertDialog("Different items amount", "You've requested " + (Cards[0].length > Cards[1].length ? "less" : "more") + " items than you give. Script aborting.");
                    throw new Error("Different items amount on both sides");
                }

                if (Cards[0].length === 0) {
                    throw new Error("nothing to add, exiting");
                }
                // clear cookie containing last opened inventory tab - prevents unwanted inventory loading (it will be restored later)
                let oldCookie = document.cookie.split("strTradeLastInventoryContext=")[1];
                if (oldCookie) {
                    oldCookie = oldCookie.split(";")[0];
                }
                document.cookie = "strTradeLastInventoryContext=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/tradeoffer/";

                let Users = [unsafeWindow.UserYou, unsafeWindow.UserThem];
                let global_vars = { Users: Users, oldCookie: oldCookie, Cards: Cards };

                window.setTimeout(checkContexts, 500, globalSettings, global_vars);
            }
        } catch (e) {
            debugPrint(e);
        }
    }
})();
