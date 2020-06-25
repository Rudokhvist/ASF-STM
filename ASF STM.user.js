// ==UserScript==
// @name        ASF STM
// @language    English
// @namespace   https://greasyfork.org/users/2205
// @description ASF bot list trade matcher
// @license     Apache-2.0
// @author      Ryzhehvost
// @include     http*://steamcommunity.com/id/*/badges
// @include     http*://steamcommunity.com/id/*/badges/
// @include     http*://steamcommunity.com/profiles/*/badges
// @include     http*://steamcommunity.com/profiles/*/badges/
// @version     1.4
// @connect     asf.justarchi.net
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// ==/UserScript==

(function() {
    "use strict";
    const limiter = 0;
    const errorLimiter = 1000;
    const debug = false;
    const maxErrors = 5;
    const filterBackgroundColor = 'rgba(103, 193, 245, 0.2)';
    let errors = 0;
    let bots;
    let assets = [];
    let descriptions = [];
    let myBadges = [];
    let botBadges = [];
    let maxPages;
    let stop = false;

    function debugTime(name) {
        if (debug) {
            console.time(name);
        }
    }

    function debugTimeEnd(name) {
        if (debug) {
            console.timeEnd(name);
        }
    }

    function debugPrint(msg) {
        if (debug) {
            console.log(msg);
        }
    }

    function deepClone(object) {
        return JSON.parse(JSON.stringify(object));
    }

    function getPartner(str) {
        if (typeof(BigInt)!=="undefined") {
            return (BigInt(str) % BigInt(4294967296)).toString(); // eslint-disable-line
        } else {
            let result = 0;
            for (let i = 0; i < str.length; i++) {
                result = (result * 10 + Number(str[i])) % 4294967296;
            }
            return result;
        }
    }

    function enableButton() {
        let buttonDiv = document.getElementById("asf_stm_button_div");
        buttonDiv.setAttribute("class", "profile_small_header_additional");
        let button = document.getElementById("asf_stm_button");
        button.addEventListener("click", buttonPressedEvent, false);
    }

    function disableButton() {
        let buttonDiv = document.getElementById("asf_stm_button_div");
        buttonDiv.setAttribute("class", "profile_small_header_additional btn_disabled");
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

    function updateProgress(index) {
        let bar = document.getElementById("asf_stm_progress");
        let progress = 100 * ((index + 1) / bots.length);
        bar.setAttribute("style", "width: " + progress + "%;");
    }

    function populateCards(item) {
        let classList = "";
        let htmlCards = "";
        for (let j = 0; j < item.cards.length; j++) {
            let itemIcon = item.cards[j].iconUrl;
            let itemName = item.cards[j].item.substring(item.cards[j].item.indexOf("-") + 1);
            for (let k = 0; k < item.cards[j].count; k++) {
                if (classList != "") {
                    classList += ";";
                }
                classList += item.cards[j].class;
                let cardTemplate = `
                          <div class="showcase_slot">
                            <img class="image-container" src="https://steamcommunity-a.akamaihd.net/economy/image/${itemIcon}/98x115">
                            <div class="commentthread_subscribe_hint" style="width: 98px;">${itemName}</div>
                          </div>
                `;
                htmlCards += cardTemplate;
            }
        }
        return {
            "htmlCards": htmlCards,
            "classList": classList
        };
    }

    function getClasses(item) {
        let classes = "";
        for (let j = 0; j < item.cards.length; j++) {
            for (let k = 0; k < item.cards[j].count; k++) {
                if (classes != "") {
                    classes += ";";
                }
                classes += item.cards[j].class;
            }
        }
        return classes;
    }

    function updateTrade(row) {
        let index = row.id.split("_")[1];
        let tradeLink = row.getElementsByClassName("full_trade_url")[0];
        let splitUrl = tradeLink.href.split("&");
        let them = "";
        let you = "";
        let filterWidget = document.getElementById("asf_stm_filters_body");
        for (let i = 0; i < bots[index].itemsToSend.length; i++) {
            let appId = bots[index].itemsToSend[i].appId;
            let checkBox = document.getElementById("astm_" + appId);
            if (checkBox.checked) {
                if (you != "") {
                    you += ";";
                }
                you = you + getClasses(bots[index].itemsToSend[i]);
                if (them != "") {
                    them += ";";
                }
                them = them + getClasses(bots[index].itemsToReceive[i]);
            }
        }
        splitUrl[3] = "them=" + them;
        splitUrl[4] = "you=" + you;
        tradeLink.href = splitUrl.join("&");
    }

    function checkRow(row) {
        debugPrint("checkRow");
        let matches = row.getElementsByClassName("badge_row");
        let visible = false;
        for (let i = 0; i < matches.length; i++) {
            if (matches[i].parentElement.style.display != "none") {
                visible = true;
                break;
            }
        }
        if (visible) {
            row.style.display = "block";
            updateTrade(row);
        } else {
            row.style.display = "none";
        }
    }

    function addMatchRow(index, botname) {
        debugPrint("addMatchRow " + index);
        let itemsToSend = bots[index].itemsToSend;
        let itemsToReceive = bots[index].itemsToReceive;
        let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=" + getPartner(bots[index].steam_id) + "&token=" + bots[index].trade_token + "&source=stm";
        let globalYou = "";
        let globalThem = "";
        let matches = "";
        let any = "";
        if (bots[index].match_everything == 1) {
            any = `&nbsp;<sup><span class="avatar_block_status_in-game" style="font-size: 8px; cursor:help" title="This bots trades for any cards within same set">&nbsp;ANY&nbsp;</span></sup>`;
        }
        for (let i = 0; i < itemsToSend.length; i++) {
            let appId = itemsToSend[i].appId;
            let itemToReceive = itemsToReceive.find(a => a.appId == appId);
            let gameName = itemsToSend[i].title;
            let display = "inline-block";

            //remove placeholder
            let filterWidget = document.getElementById("asf_stm_filters_body");
            let placeholder = document.getElementById("asf_stm_placeholder");
            if (placeholder != null) {
                placeholder.remove();
            }
            //add filter
            let checkBox = document.getElementById("astm_" + appId);
            if (checkBox == null) {
                let newFilter = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" />${gameName}</span>`;
                let spanTemplate = document.createElement("template");
                spanTemplate.innerHTML = newFilter.trim();
                filterWidget.appendChild(spanTemplate.content.firstChild);
            } else {
                if (checkBox.checked == false) {
                    display = "none";
                }
            }

            let sendResult = populateCards(itemsToSend[i]);
            let receiveResult = populateCards(itemToReceive);

            let tradeUrlApp = tradeUrl + "&them=" + receiveResult.classList + "&you=" + sendResult.classList;

            let matchTemplate = `
                  <div class="asf_stm_appid_${appId}" style="display:${display}">
                    <div class="badge_row is_link goo_untradable_note showcase_slot">
                      <div class="notLoggedInText">
                        <img alt="${gameName}" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg">
                        <div>
                          <div title="View badge progress for this game">
                            <a target="_blank" href="https://steamcommunity.com/my/gamecards/${appId}/">${gameName}</a>
                          </div>
                        </div>
                        <div class="btn_darkblue_white_innerfade btn_medium">
                          <span>
                            <a href="${tradeUrlApp}" target="_blank" rel="noopener">Offer a trade</a>
                          </span>
                        </div>
                      </div>
                      <div class="showcase_slot">
                          <div class="showcase_slot profile_header">
                              <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_in-game badge_info_title badge_row_overlay" style="height: 15px;">You</div>
                              ${sendResult.htmlCards}
                          </div>
                          <span class="showcase_slot badge_info_title booster_creator_actions">
                              <h1>&#10145;</h1>
                          </span>
                      </div>
                      <div class="showcase_slot profile_header">
                          <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_online badge_info_title badge_row_overlay ellipsis" style="height: 15px;">
                            ${botname}
                          </div>
                        ${receiveResult.htmlCards}
                      </div>
                    </div>
                  </div>
            `;
            if (checkBox == null || checkBox.checked) {
                matches += matchTemplate;
                if (globalYou != "") {
                    globalYou += ";";
                }
                globalYou += sendResult.classList;
                if (globalThem != "") {
                    globalThem += ";";
                }
                globalThem += receiveResult.classList;
            }
        }
        let tradeUrlFull = tradeUrl + "&them=" + globalThem + "&you=" + globalYou;
        let rowTemplate = `
            <div id="asfstmbot_${index}" class="badge_row">
              <div class="badge_row_inner">
                <div class="badge_title_row guide_showcase_contributors">
                  <div class="badge_title_stats">
                    <div class="btn_darkblue_white_innerfade btn_medium">
                      <span>
                        <a class="full_trade_url" href="${tradeUrlFull}" target="_blank" rel="noopener" >Offer a trade for all</a>
                      </span>
                    </div>
                  </div>
                  <div class="badge_title">
                    ${botname}${any}
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
        mainContentDiv.appendChild(newChild);
        checkRow(newChild);
    }

    function fetchInventory(steamId, startAsset, callback) {
        let url = "https://steamcommunity.com/inventory/" + steamId + "/753/6?l=english&count=5000&l=english";
        if (startAsset > 0) {
            url = url + "&start_assetid=" + startAsset.toString();
        } else {
            assets.length = 0;
            descriptions.length = 0;
        }
        debugPrint(url);
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "json";
        xhr.onload = function() {
            debugPrint("...");
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
            let status = xhr.status;
            let lastAsset = startAsset;
            if (status === 200) {
                errors = 0;
                if (typeof(xhr.response) !== "undefined") {
                    if (typeof(xhr.response.descriptions) !== "undefined") {
                        assets = [...assets,...xhr.response.assets];
                        descriptions = [...descriptions,...xhr.response.descriptions];
                        if (typeof(xhr.response.last_assetid) == "undefined") { //end of inventory
                            debugPrint("total_inventory_count = " + xhr.response.total_inventory_count);
                            callback();
                            return;
                        } else {
                            lastAsset = xhr.response.last_assetid;
                        }
                    }
                }
            } else {
                errors++;
                debugPrint("HTTP Error=" + status);
            }
            if (status == 403) {
                assets.length = 0; //switch to next bot
                callback();
            } else if ((status < 400 || status >= 500 || status == 408) && (errors <= maxErrors)) {
                setTimeout((function(steamId, startAsset, callback) {
                    return function() {
                        fetchInventory(steamId, startAsset, callback);
                    };
                })(steamId, lastAsset, callback), limiter+errorLimiter*errors);
            } else {
                updateMessage("Error getting inventory, ERROR " + status);
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.onerror = function() {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
            errors++;
            if (errors <= maxErrors) {
                setTimeout((function(steamId, startAsset, callback) {
                    return function() {
                        fetchInventory(steamId, startAsset, callback);
                    };
                })(steamId, startAsset, callback), limiter+errorLimiter*errors);
            } else {
                debugPrint("error getting inventory");
                updateMessage("Error getting inventory");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.send();
    }

    function calcState(badge) { //state 0 - less than max sets; state 1 - we have max sets, even out the rest, state 2 - all even
        if (badge.cards[badge.maxCards - 1].count == badge.maxSets) {
            if (badge.cards[0].count == badge.lastSet) {
                return 2; //nothing to do
            } else {
                return 1; //max sets are here, but we can distribute cards further
            }
        } else {
            return 0; //less than max sets
        }
    }

    function compareCards(index, callback) {
        let itemsToSend = [];
        let itemsToReceive = [];
        botBadges.length = 0;
        botBadges = deepClone(myBadges);
        for (let i = 0; i < botBadges.length; i++) {
            botBadges[i].cards.length = 0;
        }
        populateExistingCards(botBadges, false);
        debugPrint("bot's cards");
        debugPrint(deepClone(botBadges));
        debugPrint("our cards");
        debugPrint(deepClone(myBadges));

        for (let i = 0; i < botBadges.length; i++) {
            let myBadge = deepClone(myBadges[i]);
            let theirBadge = deepClone(botBadges[i]);
            let myState = calcState(myBadge);
            debugPrint("state="+myState);
            debugPrint("myapp="+myBadge.appId+" botapp="+theirBadge.appId);
            while (myState < 2) {
                let foundMatch = false;
                for (let j = 0; j < theirBadge.maxCards; j++) { //index of card they give
                    if (theirBadge.cards[j].count > 0) {
                        //try to match
                        //if (bots[index].match_everything) {}
                        let myInd = myBadge.cards.findIndex(a => a.item == theirBadge.cards[j].item); //index of slot where we receive card
                        if (myInd == -1) {
                            debugPrint("we don't have it");
                            let empty = myBadge.cards.find(card => card.item == null);
                            if (empty != undefined) {
                                debugPrint("found a place!");
                                empty.item = theirBadge.cards[j].item;
                                empty.iconUrl = theirBadge.cards[j].iconUrl;
                                myInd = myBadge.cards.indexOf(empty);
                            } else {
                                debugPrint("Error! We found more cards than expected");
                                debugPrint(deepClone(myBadge.cards));
                                debugPrint(deepClone(theirBadge.cards));
                            }
                        }
                        if ((myState == 0 && myBadge.cards[myInd].count < myBadge.maxSets) ||
                            (myState == 1 && myBadge.cards[myInd].count < myBadge.lastSet)) { //we need this ^Kfor the Emperor
                            debugPrint("we need this: " + theirBadge.cards[j].item + " (" + theirBadge.cards[j].count + ")");
                            //find a card to match.
                            for (let k = 0; k < myInd; k++) { //index of card we give
                                debugPrint("i=" + i + " j=" + j + " k=" + k + " myState=" + myState);
                                debugPrint("we have this: " + myBadge.cards[k].item + " (" + myBadge.cards[k].count + ")");
                                if ((myState == 0 && myBadge.cards[k].count > myBadge.maxSets) ||
                                    (myState == 1 && myBadge.cards[k].count > myBadge.lastSet)) { //that's fine for us
                                    debugPrint("it's a good trade for us");
                                    let theirInd = theirBadge.cards.findIndex(a => a.item == myBadge.cards[k].item); //index of slot where they will receive card
                                    if (theirInd == -1) { //they don't even know this card
                                        theirInd = theirBadge.cards.findIndex(a => a.item == null); //index of empty space
                                        //it's safe to assign item name to this card, they don't have it
                                        theirBadge.cards[theirInd].item = myBadge.cards[k].item;
                                    }
                                    if (bots[index].match_everything == 0) { //make sure it's neutral+ for them
                                        if (theirBadge.cards[theirInd].count >= theirBadge.cards[j].count) {
                                            debugPrint("Not fair for them");
                                            debugPrint("they have this: " + theirBadge.cards[theirInd].item + " (" + theirBadge.cards[theirInd].count + ")");
                                            continue; //it's not neutral+, check other options
                                        }
                                    }
                                    debugPrint("it's a match!");
                                    let itemToSend = {
                                        "item": myBadge.cards[k].item,
                                        "count": 1,
                                        "class": myBadge.cards[k].class,
                                        "iconUrl": myBadge.cards[k].iconUrl
                                    };
                                    let itemToReceive = {
                                        "item": theirBadge.cards[j].item,
                                        "count": 1,
                                        "class": theirBadge.cards[j].class,
                                        "iconUrl": theirBadge.cards[j].iconUrl
                                    };
                                    //fill items to send
                                    let sendmatch = itemsToSend.find(item => item.appId == myBadges[i].appId);
                                    if (sendmatch == undefined) {
                                        let newMatch = {
                                            "appId": myBadges[i].appId,
                                            "title": myBadge.title,
                                            "cards": [itemToSend]
                                        };
                                        itemsToSend.push(newMatch);
                                    } else {
                                        let existingCard = sendmatch.cards.find(a => a.item == itemToSend.item);
                                        if (existingCard == undefined) {
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
                                    let receiveMatch = itemsToReceive.find(item => item.appId == myBadges[i].appId);
                                    if (receiveMatch == undefined) {
                                        let newMatch = {
                                            "appId": myBadges[i].appId,
                                            "title": myBadge.title,
                                            "cards": [itemToReceive]
                                        };
                                        itemsToReceive.push(newMatch);
                                    } else {
                                        let existingCard = sendmatch.cards.find(a => a.item == itemToReceive.item);
                                        if (existingCard == undefined) {
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
                        }
                    }
                }
                if (!foundMatch) {
                    break; //found no matches - move to next badge
                }
                myBadge.cards.sort((a, b) => b.count - a.count);
                theirBadge.cards.sort((a, b) => b.count - a.count);
                myState = calcState(myBadge);
            }
        }
        debugPrint("items to send");
        debugPrint(deepClone(itemsToSend));
        debugPrint("items to receive");
        debugPrint(deepClone(itemsToReceive));
        bots[index].itemsToSend = itemsToSend;
        bots[index].itemsToReceive = itemsToReceive;
        if (itemsToSend.length > 0) {
            getUsername(index, callback);
        } else {
            debugPrint("no matches");
            callback();
        }
    }

    function getUsername(index, callback) {
        let url = "https://steamcommunity.com/profiles/" + bots[index].steam_id + "?xml=1";
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "text"; //TODO: consider XML maybe?
        //xhr.setRequestHeader("Range","bytes=0-200"); //fuck it, get the whole page
        xhr.onload = function() {
            let status = xhr.status;
            let username = bots[index].steam_id;
            debugPrint("getting username");
            if (status === 200) {
                errors = 0;
                let re = /<steamID><!\[CDATA\[(.+)\]\]><\/steamID>/g;
                username = re.exec(xhr.response)[1];
                debugPrint(username);
                addMatchRow(index, username);
                callback();
            } else {
                if (stop) {
                    updateMessage("Interrupted by user");
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.remove();
                    return;
                }
                errors++;
                if (errors <= maxErrors) {
                    setTimeout((function(index, callback) {
                        return function() {
                            getUsername(index, callback);
                        };
                    })(index, callback), limiter+errorLimiter*errors);
                } else {
                    debugPrint("error HTTP Status=" + status);
                    updateMessage("Error getting username data, ERROR=" + status);
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.remove();
                    return;
                }
            }
        };
        xhr.onerror = function() {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
            errors++;
            if (errors <= maxErrors) {
                setTimeout((function(index, callback) {
                    return function() {
                        getUsername(index, callback);
                    };
                })(index, callback), limiter+errorLimiter*errors);
            } else {
                debugPrint("error");
                updateMessage("Error getting username data");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.send();

    }

    function checkUser(index) {
        debugPrint(index);
        updateMessage("Fetching bot " + (index + 1).toString() + " of " + bots.length.toString());
        updateProgress(index);
        fetchInventory(bots[index].steam_id, 0, function() {
            debugPrint(bots[index].steam_id);
            debugPrint(assets.length);
            compareCards(index, function() {
                if (index < bots.length - 1) {
                    setTimeout((function(index) {
                        return function() {
                            checkUser(index);
                        };
                    })(index + 1), limiter);
                } else {
                    debugPrint("finished");
                    debugPrint(new Date(Date.now()));
                    hideThrobber();
                    hideMessage();
                    updateProgress(bots.length - 1);
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.remove();
                }
            });
        });
    }

    function populateExistingCards(badges, filter) {
        debugTime("PopulateExistingCards1");
        debugPrint(deepClone(assets));
        debugPrint(deepClone(descriptions));
        descriptions = descriptions.filter(desc => badges.find(item => item.appId == desc.market_hash_name.split("-")[0]) != undefined);
        assets = assets.filter(asset => descriptions.find(item => item.classid == asset.classid) != undefined);
        for (let i = 0; i < assets.length; i++) {
            debugPrint(".");
            let descr = descriptions.find(desc => desc.classid == assets[i].classid); // eslint-disable-line
            if (descr != undefined) {
                let appId = descr.market_hash_name.split("-")[0];
                let title = appId;
                let gameTag = descr.tags.find(tag => tag.category == "Game");
                if (gameTag != undefined) {
                    title = gameTag.localized_tag_name;
                }
                let itemClassTag = descr.tags.find(tag => tag.category == "item_class");
                if (itemClassTag != undefined) {
                    if (itemClassTag.internal_name == "item_class_2") {
                        let cardBorderTag = descr.tags.find(tag => tag.category == "cardborder");
                        if (cardBorderTag != undefined) {
                            if (cardBorderTag.internal_name == "cardborder_0") {
                                let badge = badges.find(badge => badge.appId == appId);
                                if (badge != undefined) {
                                    let card = badge.cards.find(card => card.item == descr.market_hash_name);
                                    if (card == undefined) {
                                        let newcard = {
                                            "item": descr.market_hash_name,
                                            "count": 1,
                                            "class": assets[i].classid,
                                            "iconUrl": descr.icon_url
                                        };
                                        badge.cards.push(newcard);
                                        badge.title = title;
                                    } else {
                                        card.count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        debugTimeEnd("PopulateExistingCards1");
        debugTime("PopulateExistingCards2");
        for (let i = badges.length - 1; i >= 0; i--) {
            for (let j = badges[i].cards.length; j < badges[i].maxCards; j++) {
                badges[i].cards.push({
                    "item": null,
                    "count": 0,
                    "class": 0,
                    "iconUrl": null
                }); //fill missing cards with dummy element
            }
            badges[i].cards.sort((a, b) => b.count - a.count);
            if (filter) {
                if (badges[i].cards[0].count - badges[i].cards[badges[i].cards.length - 1].count < 2) {
                    //nothing to match, remove from list.
                    badges.splice(i, 1);
                    continue;
                }
            }
            let totalCards = 0;
            for (let j = 0; j < badges[i].maxCards; j++) {
                totalCards += badges[i].cards[j].count;
            }
            badges[i].maxSets = Math.floor(totalCards / badges[i].maxCards);
            badges[i].lastSet = Math.ceil(totalCards / badges[i].maxCards);
        }
        debugTimeEnd("PopulateExistingCards2");
    }

    function populateMaxCards(index) {
        while (index < myBadges.length) {
            if (myBadges[index].maxCards === 0) {
                let url = "https://steamcommunity.com/my/gamecards/" + myBadges[index].appId + "?l=english";
                let xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "document";
                xhr.onload = function() { // eslint-disable-line
                    if (stop) {
                        updateMessage("Interrupted by user");
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }
                    let status = xhr.status;
                    if (status === 200) {
                        errors = 0;
                        debugPrint("processing badge " + myBadges[index].appId);
                        updateMessage("Getting badge data for " + myBadges[index].appId);
                        let maxCards = xhr.response.documentElement.getElementsByClassName("gamecard").length;
                        myBadges[index].maxCards = maxCards;
                        index++;
                    } else {
                        errors++;
                    }
                    if ((status < 400 || status >= 500) && (errors <= maxErrors)) {
                        setTimeout((function(index) {
                            return function() {
                                populateMaxCards(index);
                            };
                        })(index), limiter+errorLimiter*errors);
                    } else {
                        updateMessage("Error getting badge data, ERROR " + status);
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }

                };
                xhr.onerror = function() { // eslint-disable-line
                    if (stop) {
                        updateMessage("Interrupted by user");
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }
                    errors++;
                    if (errors <= maxErrors) {
                        setTimeout((function(index) {
                            return function() {
                                populateMaxCards(index);
                            };
                        })(index), limiter+errorLimiter*errors);
                        return;
                    } else {
                        debugPrint("error");
                        updateMessage("Error getting badge data");
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }
                };
                xhr.send();
                return; //do this synchronously to avoid rate limit
            } else {
                index++;
            }
        }
        debugPrint("populated");
        updateMessage("Fetching own inventory");
        //g_steamID is a global steam variable
        let re = /g_steamID = "(.*)";/g;
        let g_steamID = re.exec(document.documentElement.textContent)[1];
        fetchInventory(g_steamID, 0, function() {
            debugPrint("fetched");
            debugPrint(deepClone(assets));
            debugPrint(deepClone(descriptions));
            debugPrint("our cards");
            debugPrint(deepClone(myBadges));
            populateExistingCards(myBadges, true);
            if (myBadges.length === 0) {
                hideThrobber();
                updateMessage("No cards to match");
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
            checkUser(0);
        });
    }

    function getBadges(page) {
        let url = "https://steamcommunity.com/my/badges?p=" + page + "&l=english";
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "document";
        xhr.onload = function() {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
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
                let badges = xhr.response.documentElement.getElementsByClassName("badge_row_inner");
                for (let i = 0; i < badges.length; i++) {
                    if (badges[i].getElementsByClassName("owned").length > 0) { //we only need badges where we have at least one card, and no special badges
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
                                let badgeStub = {
                                    "appId": appId,
                                    "title": null,
                                    "maxCards": maxCards,
                                    "maxSets": 0,
                                    "lastSet": 0,
                                    "cards": []
                                };
                                myBadges.push(badgeStub);
                            }
                        }
                    }
                }
                page++;
            } else {
                errors++;
            }
            if ((status < 400 || status >= 500) && (errors <= maxErrors)) {
                if (page <= maxPages) {
                    setTimeout((function(page) {
                        return function() {
                            getBadges(page);
                        };
                    })(page), limiter+errorLimiter*errors);
                } else {
                    debugPrint("all badge pages processed");
                    if (myBadges.length === 0) {
                        hideThrobber();
                        updateMessage("No cards to match");
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    } else {
                        populateMaxCards(0);
                    }
                }
            } else {
                updateMessage("Error getting badge data, ERROR " + status);
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.onerror = function() {
            if (stop) {
                updateMessage("Interrupted by user");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
            errors++;
            if (errors <= maxErrors) {
                setTimeout((function(page) {
                    return function() {
                        getBadges(page);
                    };
                })(page), limiter+errorLimiter*errors);
            } else {
                debugPrint("error getting badge page");
                updateMessage("Error getting badge page");
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.send();
    }

    function filterEventHandler(event) {
        let appId = event.target.id.split("_")[1];
        let matches = document.getElementsByClassName("asf_stm_appid_" + appId);
        for (let i = 0; i < matches.length; i++) {
            matches[i].style.display = event.target.checked ? "inline-block" : "none";
            checkRow(matches[i].parentElement.parentElement);
        }
    }

    function filterSwitchesHandler(event) {
        let action = event.target.id.split("_")[3];
        let filterWidget = document.getElementById("asf_stm_filters_body");
        let checkboxes=filterWidget.getElementsByTagName("input");
        for (let i = 0; i < checkboxes.length; i++) {
            if (action==="all") {
                if (!checkboxes[i].checked) {
                    checkboxes[i].checked=true;
                    filterEventHandler({"target":checkboxes[i]});
                }
            } else if (action==="none") {
                if (checkboxes[i].checked) {
                    checkboxes[i].checked=false;
                    filterEventHandler({"target":checkboxes[i]});
                }
            } else if (action==="invert") {
                checkboxes[i].checked=!checkboxes[i].checked;
                filterEventHandler({"target":checkboxes[i]});
            }
        }
    }

    function filtersButtonEvent() {
        let filterWidget = document.getElementById("asf_stm_filters");
        if (filterWidget.style.marginRight == "-50%") {
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
                <div id="asf_stm_progress" class="profile_xp_block_remaining_bar_progress" style="width: 100%;">
                </div>
              </div>
            </div>
          </div>
          <div id="asf_stm_filters" style="position: fixed; z-index: 1000; right: 5px; bottom: 45px; transition-duration: 500ms;
                   transition-timing-function: ease; margin-right: -50%; padding: 5px; max-width: 40%; display: inline-block; border-radius: 2px;
                   background:${filterBackgroundColor}; color: #67c1f5;">
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
        getBadges(1);
    }

    if (document.getElementsByClassName("badge_details_set_favorite").length != 0) {
        let requestUrl = "https://asf.justarchi.net/Api/Bots";
        let requestFunc;
        if (typeof (GM_xmlhttpRequest) !== "function") {
            requestFunc = GM.xmlHttpRequest.bind(GM);
        } else {
            requestFunc = GM_xmlhttpRequest;
        }
        requestFunc({
            method: "GET",
            url: requestUrl,
            onload: function(response) {
                if (response.status != 200) {
                    debugPrint("can't fetch list of bots, ERROR="+response.status);
                    debugPrint(response);
                    return;
                }
                let re = /("steam_id":)(\d+)/g;
                let fixedJson = response.response.replace(re, "$1\"$2\""); //because fuck js
                bots = JSON.parse(fixedJson);
                //bots.filter(bot=>bot.matchable_cards===1||bot.matchable_foil_cards===1);  //I don't think this is really needed
                bots.sort(function(a, b) { //sort received array as I like it. TODO: sort according to settings
                    let result = b.match_everything - a.match_everything; //bots with match_everything go first
                    if (result === 0) {
                        result = b.items_count - a.items_count; //then by items_counts descending
                    }
                    if (result === 0) {
                        result = b.games_count - a.games_count; //then by games_count descending
                    }
                    return result;
                });
                debugPrint("found total " + bots.length + " bots");
                let buttonDiv = document.createElement("div");
                buttonDiv.setAttribute("class", "profile_small_header_additional");
                buttonDiv.setAttribute("style", "margin-top: 40px;");
                buttonDiv.setAttribute("id", "asf_stm_button_div");
                let button = document.createElement("a");
                button.setAttribute("class", "btnv6_blue_hoverfade btn_medium");
                button.setAttribute("id", "asf_stm_button");
                button.appendChild(document.createElement("span"));
                button.firstChild.appendChild(document.createTextNode("Scan ASF STM"));
                buttonDiv.appendChild(button);
                let anchor = document.getElementsByClassName("profile_small_header_texture")[0];
                anchor.appendChild(buttonDiv);
                enableButton();
            },
            onerror: function(response) {
                debugPrint("can't fetch list of bots");
                debugPrint(response);
            },
            onabort: function(response) {
                debugPrint("can't fetch list of bots - aborted");
                debugPrint(response);
            },
            ontimeout: function(response) {
                debugPrint("can't fetch list of bots - timeout");
                debugPrint(response);
            }
        });
    }
})();
