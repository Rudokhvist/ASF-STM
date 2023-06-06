// ==UserScript==
// @name            ASF STM DEV
// @namespace       https://greasyfork.org/users/2205
// @description     ASF bot list trade matcher
// @description:vi  Trình khớp lệnh giao dịch danh sách bot ASF
// @license         Apache-2.0
// @author          Ryzhehvost
// @match           *://steamcommunity.com/id/*/badges
// @match           *://steamcommunity.com/id/*/badges/
// @match           *://steamcommunity.com/profiles/*/badges
// @match           *://steamcommunity.com/profiles/*/badges/
// @match           *://steamcommunity.com/tradeoffer/new/*source=asfstm*
// @version         3.0
// @connect         asf.justarchi.net
// @grant           GM.xmlHttpRequest
// @grant           GM_addStyle
// @grant           GM_xmlhttpRequest
// ==/UserScript==

(function () {
    "use strict";
    //configuration
    //TODO: make configuration configurable
    const weblimiter = 300;
    const errorLimiter = 30000;
    const debug = true;
    const maxErrors = 3;
    const botCacheTime = 5 * 60000;
    const filterBackgroundColor = "rgba(23, 26, 33, 0.8)"; //"rgba(103, 193, 245, 0.8)";

    //styles
    const css = `
    #asf_stm_filters_body {
        max-height: calc(100vh - 95px);
        overflow-y: auto;
    }
    `;

    //do not change
    let myProfileLink = "";
    let errors = 0;
    let bots = null;
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
            return result;
        }
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

    function updateProgress(index) {
        let bar = document.getElementById("asf_stm_progress");
        let progress = 100 * ((index + 1) / bots.Result.length);
        bar.setAttribute("style", "width: " + progress + "%;");
    }

    function populateCards(item) {
        let nameList = "";
        let htmlCards = "";
        //TODO! Check for same hash but different name, ask user to report
        for (let j = 0; j < item.cards.length; j++) {
            for (let i = 0; j < item.cards.length; i++) {
                if (i != j && item.cards[i].name != item.cards[j].name &&
                   item.cards[j].iconUrl.substring(item.cards[j].iconUrl.length - 5) == item.cards[i].iconUrl.substring(item.cards[i].iconUrl.length - 5)) {
                    unsafeWindow.ShowAlertDialog('WARNING', 'Different cards have same signature, please report this: ' + item.appId);
                }
            }
        }
        for (let j = 0; j < item.cards.length; j++) {
            let itemIcon = item.cards[j].iconUrl; //+"/98x115";
            let itemName = item.cards[j].item; //.substring(item.cards[j].item.indexOf("-") + 1);
            for (let k = 0; k < item.cards[j].count; k++) {
                if (nameList != "") {
                    nameList += ";";
                }
                nameList += encodeURIComponent(item.cards[j].iconUrl.substring(item.cards[j].iconUrl.length - 5) + "." + item.appId + "-" + item.cards[j].item);
                let cardTemplate = `
                          <div class="showcase_slot">
                            <img class="image-container" src="${itemIcon}/98x115">
                            <div class="commentthread_subscribe_hint" style="width: 98px;">${itemName}</div>
                          </div>
                `;
                htmlCards += cardTemplate;
            }
        }
        return {
            htmlCards: htmlCards,
            nameList: nameList
        };
    }

    function getNames(item) {
        let names = "";
        for (let j = 0; j < item.cards.length; j++) {
            for (let k = 0; k < item.cards[j].count; k++) {
                if (names != "") {
                    names += ";";
                }
                names += encodeURIComponent(item.cards[j].iconUrl.substring(item.cards[j].iconUrl.length - 5) + "." + item.appId + "-" + item.cards[j].item);
            }
        }
        return names;
    }

    function updateTrade(row) {
        let index = row.id.split("_")[1];
        let tradeLink = row.getElementsByClassName("full_trade_url")[0];
        let splitUrl = tradeLink.href.split("&");
        let them = "";
        let you = "";
        //let filterWidget = document.getElementById("asf_stm_filters_body");
        for (let i = 0; i < bots.Result[index].itemsToSend.length; i++) {
            let appId = bots.Result[index].itemsToSend[i].appId;
            let checkBox = document.getElementById("astm_" + appId);
            if (checkBox.checked) {
                if (you != "") {
                    you += ";";
                }
                you = you + getNames(bots.Result[index].itemsToSend[i]);
                if (them != "") {
                    them += ";";
                }
                them = them + getNames(bots.Result[index].itemsToReceive[i]);
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
        itemsToSend.sort(compareNames);
        itemsToReceive.sort(compareNames);

        let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=" + getPartner(bots.Result[index].SteamID) + "&token=" + bots.Result[index].TradeToken + "&source=asfstm";

        let globalYou = "";
        let globalThem = "";
        let matches = "";
        let any = "";
        if (bots.Result[index].MatchEverything == 1) {
            any = `&nbsp;<sup><span class="avatar_block_status_in-game" style="font-size: 8px; cursor:help" title="This bots trades for any cards within same set">&nbsp;ANY&nbsp;</span></sup>`;
        }
        for (let i = 0; i < itemsToSend.length; i++) {
            let appId = itemsToSend[i].appId;
            let itemToReceive = itemsToReceive.find((a) => a.appId == appId);
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
                let newFilter = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" /><label for="astm_${appId}">${gameName}</label></span>`;
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

            let tradeUrlApp = tradeUrl + "&them=" + receiveResult.nameList + "&you=" + sendResult.nameList;

            let matchTemplate = `
                  <div class="asf_stm_appid_${appId}" style="display:${display}">
                    <div class="badge_row is_link goo_untradable_note showcase_slot">
                      <div class="notLoggedInText">
                        <img style="background-color: var(--gpStoreDarkerGrey);" height=69 alt="${gameName}" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg"
                        onerror="this.onerror=null;this.src='https://store.akamai.steamstatic.com/public/images/gift/steam_logo_digitalgiftcard.png'">
                        <div>
                          <div title="View badge progress for this game">
                            <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${myProfileLink}/gamecards/${appId}/">${gameName}</a>
                          </div>
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
                              ${sendResult.htmlCards}
                          </div>
                          <span class="showcase_slot badge_info_title booster_creator_actions">
                              <h1>&#10145;</h1>
                          </span>
                      </div>
                      <div class="showcase_slot profile_header">
                          <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_online badge_info_title badge_row_overlay ellipsis" style="height: 15px;">
                            ${bots.Result[index].Nickname}
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
                globalYou += sendResult.nameList;
                if (globalThem != "") {
                    globalThem += ";";
                }
                globalThem += receiveResult.nameList;
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

    function calcState(badge) {
        //state 0 - less than max sets; state 1 - we have max sets, even out the rest, state 2 - all even
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
                        let myInd = myBadge.cards.findIndex((a) => a.item == theirBadge.cards[j].item); //index of slot where we receive card
                        if ((myState == 0 && myBadge.cards[myInd].count < myBadge.maxSets) || (myState == 1 && myBadge.cards[myInd].count < myBadge.lastSet)) {
                            //we need this ^Kfor the Emperor
                            debugPrint("we need this: " + theirBadge.cards[j].item + " (" + theirBadge.cards[j].count + ")");
                            //find a card to match.
                            for (let k = 0; k < myInd; k++) {
                                //index of card we give
                                debugPrint("i=" + i + " j=" + j + " k=" + k + " myState=" + myState);
                                debugPrint("we have this: " + myBadge.cards[k].item + " (" + myBadge.cards[k].count + ")");
                                if ((myState == 0 && myBadge.cards[k].count > myBadge.maxSets) || (myState == 1 && myBadge.cards[k].count > myBadge.lastSet)) {
                                    //that's fine for us
                                    debugPrint("it's a good trade for us");
                                    let theirInd = theirBadge.cards.findIndex((a) => a.item == myBadge.cards[k].item); //index of slot where they will receive card
                                    if (bots.Result[index].MatchEverything == 0) {
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
                                        iconUrl: myBadge.cards[k].iconUrl
                                    };
                                    let itemToReceive = {
                                        item: theirBadge.cards[j].item,
                                        count: 1,
                                        iconUrl: theirBadge.cards[j].iconUrl
                                    };
                                    //fill items to send
                                    let sendmatch = itemsToSend.find(item => item.appId == myBadge.appId);
                                    if (sendmatch == undefined) {
                                        let newMatch = {
                                            appId: myBadge.appId,
                                            title: myBadge.title,
                                            cards: [itemToSend]
                                        };
                                        itemsToSend.push(newMatch);
                                    } else {
                                        let existingCard = sendmatch.cards.find((a) => a.item == itemToSend.item);
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
                                    let receiveMatch = itemsToReceive.find((item) => item.appId == myBadge.appId);
                                    if (receiveMatch == undefined) {
                                        let newMatch = {
                                            appId: myBadge.appId,
                                            title: myBadge.title,
                                            cards: [itemToReceive],
                                        };
                                        itemsToReceive.push(newMatch);
                                    } else {
                                        let existingCard = sendmatch.cards.find((a) => a.item == itemToReceive.item);
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
        debugPrint(JSON.stringify(itemsToSend));
        debugPrint("items to receive");
        debugPrint(JSON.stringify(itemsToReceive));
        bots.Result[index].itemsToSend = itemsToSend;
        bots.Result[index].itemsToReceive = itemsToReceive;
        if (itemsToSend.length > 0) {
            //getUsername(index, callback);
            addMatchRow(index);
            callback();
        } else {
            debugPrint("no matches");
            callback();
        }
    }

    function GetCards(index, userindex) {
        debugPrint("GetCards " + index + " : " + userindex);
        if (index == 0) {
            botBadges.length = 0;
            botBadges = deepClone(myBadges);
            for (let i = 0; i < botBadges.length; i++) {
                botBadges[i].cards.length = 0;
            }
        }
        if (index < botBadges.length) {
            let profileLink;
            if (userindex == -1) {
                profileLink = myProfileLink;
                updateMessage("Getting our data for badge " + (index + 1) + " of " + botBadges.length);
            } else {
                profileLink = "profiles/" + bots.Result[userindex].SteamID;
                updateMessage("Fetching bot " + (userindex + 1).toString() + " of " + bots.Result.length.toString() + " (badge " + (index + 1) + " of " + botBadges.length + ")");
                updateProgress(userindex);
            }

            let url = "https://steamcommunity.com/" + profileLink + "/gamecards/" + botBadges[index].appId + "?l=english";
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
                    stopButton.remove();
                    return;
                }
                let status = xhr.status;
                if (status === 200) {
                    debugPrint("processing badge " + botBadges[index].appId);
                    let badgeCards = xhr.response.documentElement.querySelectorAll(".badge_card_set_card");
                    if (badgeCards.length >= 5) {
                        errors = 0;
                        botBadges[index].maxCards = badgeCards.length;
                        for (let i = 0; i < badgeCards.length; i++) {
                            let quantityElement = badgeCards[i].querySelector(".badge_card_set_text_qty");
                            let quantity = quantityElement == null ? "(0)" : quantityElement.innerText.trim();
                            quantity = quantity.slice(1, -1);
                            let name = "";
                            badgeCards[i].querySelector(".badge_card_set_title").childNodes.forEach(function (element) {
                                if (element.nodeType === Node.TEXT_NODE) {
                                    name = name + element.textContent;
                                }
                            });
                            name = name.trim();
                            let icon = badgeCards[i].querySelector(".gamecard").src.trim();
                            let newcard = {
                                item: name,
                                count: Number(quantity),
                                iconUrl: icon,
                            };
                            debugPrint(JSON.stringify(newcard));
                            botBadges[index].cards.push(newcard);
                        }

                        index++;
                        setTimeout(
                            (function (index, userindex) {
                                return function () {
                                    GetCards(index, userindex);
                                };
                            })(index, userindex),
                            weblimiter
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
                if ((status < 400 || status >= 500) && errors <= maxErrors) {
                    setTimeout(
                        (function (index, userindex) {
                            return function () {
                                GetCards(index, userindex);
                            };
                        })(index, userindex),
                        weblimiter + errorLimiter * errors
                    );
                } else {
                    if (status != 200) {
                        updateMessage("Error getting badge data, ERROR " + status);
                    } else {
                        updateMessage("Error getting badge data, malformed HTML");
                    }
                    hideThrobber();
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.remove();
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
                    stopButton.remove();
                    return;
                }
                errors++;
                if (errors <= maxErrors) {
                    setTimeout(
                        (function (index, userindex) {
                            return function () {
                                GetCards(index, userindex);
                            };
                        })(index, userindex),
                        weblimiter + errorLimiter * errors
                    );
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
        }
        debugPrint("populated");

        debugTime("Filter and sort");
        for (let i = botBadges.length - 1; i >= 0; i--) {
            debugPrint("badge " + i + JSON.stringify(botBadges[i]));

            botBadges[i].cards.sort((a, b) => b.count - a.count);
            if (userindex < 0) {
                if (botBadges[i].cards[0].count - botBadges[i].cards[botBadges[i].cards.length - 1].count < 2) {
                    //nothing to match, remove from list.
                    botBadges.splice(i, 1);
                    continue;
                }
            }
            let totalCards = 0;
            for (let j = 0; j < botBadges[i].maxCards; j++) {
                totalCards += botBadges[i].cards[j].count;
            }
            botBadges[i].maxSets = Math.floor(totalCards / botBadges[i].maxCards);
            botBadges[i].lastSet = Math.ceil(totalCards / botBadges[i].maxCards);
            debugPrint("totalCards=" + totalCards + " maxSets=" + botBadges[i].maxSets + " lastSet=" + botBadges[i].lastSet);
        }
        debugTimeEnd("Filter and sort");

        if (userindex < 0) {
            if (botBadges.length == 0) {
                hideThrobber();
                updateMessage("No cards to match");
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            } else {
                myBadges = deepClone(botBadges);
                GetCards(0, 0);
                return;
            }
        } else {
            debugPrint(bots.Result[userindex].SteamID);
            compareCards(userindex, function () {
                if (userindex < bots.Result.length - 1) {
                    setTimeout(
                        (function (userindex) {
                            return function () {
                                GetCards(0, userindex);
                            };
                        })(userindex + 1),
                        weblimiter
                    );
                } else {
                    debugPrint("finished");
                    debugPrint(new Date(Date.now()));
                    hideThrobber();
                    hideMessage();
                    updateProgress(bots.Result.length - 1);
                    enableButton();
                    let stopButton = document.getElementById("asf_stm_stop");
                    stopButton.remove();
                }
            });
        }
    }

    function getBadges(page) {
        let url = "https://steamcommunity.com/" + myProfileLink + "/badges?p=" + page + "&l=english";
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "document";
        xhr.onload = function () {
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
                    if (badges[i].getElementsByClassName("owned").length > 0) {
                        //we only need badges where we have at least one card, and no special badges
                        if (!badges[i].parentElement.querySelector(".badge_row_overlay").href.endsWith("border=1")) {
                            //ignore foil badges completely so far.
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
            if ((status < 400 || status >= 500) && errors <= maxErrors) {
                if (page <= maxPages) {
                    setTimeout(
                        (function (page) {
                            return function () {
                                getBadges(page);
                            };
                        })(page),
                        weblimiter + errorLimiter * errors
                    );
                } else {
                    debugPrint("all badge pages processed");
                    debugPrint(weblimiter + errorLimiter * errors);
                    if (myBadges.length === 0) {
                        hideThrobber();
                        updateMessage("No cards to match");
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    } else {
                        setTimeout(function () {
                            GetCards(0, -1);
                        }, weblimiter + errorLimiter * errors);
                    }
                }
            } else {
                if (status != 200) {
                    updateMessage("Error getting badge page, ERROR " + status);
                } else {
                    updateMessage("Error getting badge page, malformed HTML");
                }
                hideThrobber();
                enableButton();
                let stopButton = document.getElementById("asf_stm_stop");
                stopButton.remove();
                return;
            }
        };
        xhr.onerror = function () {
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
                setTimeout(
                    (function (page) {
                        return function () {
                            getBadges(page);
                        };
                    })(page),
                    weblimiter + errorLimiter * errors
                );
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
        if (bots === null || bots.Result === undefined || bots.Result.length == 0 || bots.Success != true || bots.cacheTime + botCacheTime < Date.now()) {
            debugPrint("Bot cache invalidated");
            fetchBots();
            return;
        }
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
            onload: function (response) {
                if (response.status != 200) {
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
                        //bots.filter(bot=>bot.matchable_cards===1||bot.matchable_foil_cards===1);  //I don't think this is really needed
                        bots.Result.sort(function (a, b) {
                            //sort received array as I like it. TODO: sort according to settings
                            let result = b.MatchEverything - a.MatchEverything; //bots with MatchEverything go first
                            if (result === 0) {
                                result = b.TotalGamesCount - a.TotalGamesCount; //then by TotalGamesCount descending
                            }
                            if (result === 0) {
                                result = b.TotalItemsCount - a.TotalItemsCount; //then by TotalItemsCounts descending
                            }
                            if (result === 0) {
                                result = a.TotalInventoryCount - b.TotalInventoryCount; //then by TotalInventoryCount ascending
                            }
                            return result;
                        });
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
    localStorage.removeItem("Ryzhehvost.ASF.STM") //we used to store classid database here before, clean this up.
    if (document.getElementsByClassName("badge_details_set_favorite").length != 0) {
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
        buttonDiv.setAttribute("style", "margin-top: 40px;");
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
        enableButton();

        // add our styles to the document's style sheet
        if (typeof GM_addStyle != "undefined") {
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
        //All code below is a modified version of SteamTrade Matcher Userscript by Tithen-Firion
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
                document.cookie = 'strTradeLastInventoryContext=' + oldCookie + '; expires=' + now.toUTCString() + '; path=/tradeoffer/';
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
                    index = requestedCards.findIndex(function (elem) {
                        return ((elem.appid == inv[item].market_fee_app) && ((elem.name === inv[item].name) || inv[item].icon_url.endsWith(elem.hash)));
                    });
                    if (index > -1) {
                        if (tmpCards[requestedCards[index].id] === undefined) {
                            tmpCards[requestedCards[index].id] = [];
                        }
                        tmpCards[requestedCards[index].id].push({type: inv[item].type, element: inv[item].element, id: inv[item].id});
                    }
                });
                if (g_s.ORDER === 'SORT') {
                    // sort cards descending by card id for each type
                    Object.keys(tmpCards).forEach(function (id) {
                        tmpCards[id].sort(mySort);
                    });
                }
                // add cards to trade in order given by STM
                requestedCards.forEach(function (elem) {
                    currentCards = tmpCards[elem.id] || []; // all cards from inventory with requested signature
                    if (currentCards.length === 0) {
                        failLater = true;
                    } else {
                        index = 0;
                        if (g_s.ORDER === 'RANDOM') {
                            // randomize index
                            index = getRandomInt(0, currentCards.length);
                        }
                        unsafeWindow.MoveItemToTrade(currentCards[index].element);
                        cardTypes[i].push(currentCards[index].type);
                        currentCards.splice(index, 1);
                    }
                });
            });

            if(failLater || document.querySelectorAll('#your_slots .has_item').length != document.querySelectorAll('#their_slots .has_item').length) {
                unsafeWindow.ShowAlertDialog('Items missing', 'Some items are missing and were not added to trade offer. Script aborting.');
                throw ('Cards missing');
            }

            // check if item types match
            cardTypes[1].forEach(function (type) {
                index = cardTypes[0].indexOf(type);
                if (index > -1) {
                    cardTypes[0].splice(index, 1);
                } else {
                    unsafeWindow.ShowAlertDialog('Not 1:1 trade', 'This is not a valid 1:1 trade. Script aborting.');
                    throw ('Not 1:1 trade');
                }
            });
            restoreCookie(g_v.oldCookie);
            // inject some JS to do something after trade offer is sent
            if (g_s.DO_AFTER_TRADE !== 'NOTHING') {
                let functionToInject = 'let DO_AFTER_TRADE = "' + g_s.DO_AFTER_TRADE + '";';
                functionToInject += '$J(document).ajaxSuccess(function (event, xhr, settings) {';
                functionToInject += 'if (settings.url === "https://steamcommunity.com/tradeoffer/new/send") {';
                functionToInject += 'if (DO_AFTER_TRADE === "CLOSE_WINDOW") { window.close();';
                functionToInject += '} else if (DO_AFTER_TRADE === "CLICK_OK") {';
                functionToInject += 'document.querySelector("div.newmodal_buttons > div").click(); } } });';
                let script = document.createElement('script');
                script.appendChild(document.createTextNode(functionToInject));
                document.body.appendChild(script);
            }
            // send trade offer
            if (g_s.AUTO_SEND) {
                unsafeWindow.ToggleReady(true);
                unsafeWindow.CTradeOfferStateManager.ConfirmTradeOffer();
            }
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
                            unsafeWindow.document.getElementById('trade_inventory_unavailable').show();
                            unsafeWindow.document.getElementById('trade_inventory_pending').show();
                            user.loadInventory(753, 6);
                        }
                    }
                }
            });

            if (ready === 2) {
                // select your inventory
                unsafeWindow.TradePageSelectInventory(g_v.Users[0], 753, "6");
                // set trade offer message
                document.getElementById('trade_offer_note').value = g_s.MESSAGE;
                try {
                    addCards(g_s, g_v);
                } catch (e) {
                    // no matter what happens, restore old cookie
                    restoreCookie(g_v.oldCookie);
                    console.log(e);
                }
            } else {
                window.setTimeout(checkContexts, 500, g_s, g_v);
            }
        }

        function getUrlVars() {
            "use strict";
            let vars = [];
            let hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
            hashes.forEach(function (hash) {
                hash = hash.split('=');
                vars.push(hash[0]);
                vars[hash[0]] = hash[1];
            });
            return vars;
        }


        ///// STM functions /////

        async function restoreDefaultSettings() {
            if (window.confirm('Are you sure you want to restore default settings?')) {
                localStorage.removeItem("Ryzhehvost.ASF.STM.Settings")
                    document.location.reload();
            }
        }

        function saveSettings() {
            global_settings.MESSAGE = document.getElementById('trade-message').value;
            global_settings.DO_AFTER_TRADE = document.getElementById('after-trade').value
            global_settings.ORDER = document.getElementById('cards-order').value;
            global_settings.AUTO_SEND = document.getElementById('auto-send').checked;
            localStorage.setItem("Ryzhehvost.ASF.STM.Settings",JSON.stringify())
            document.getElementById('alert').style.display = 'block';
            window.scroll(0, 0);
        }

        function ParseCard(card) {
            let decodedVar = decodeURIComponent(card);
            const re = new RegExp("(.{5})\.([0-9]+)\-(.*)");
            let result = decodedVar.match(re);
            if (result && result.length == 4) {
                return {
                    id:card,
                    appid:result[2],
                    name: result[3],
                    hash: result[1]
                }
            } else {
                unsafeWindow.ShowAlertDialog('ASF STM Error', 'Failed to parse vars, please report it!');
                throw ('Failed to parse');
            }
        }

        function prepareSettings(g_s) { //!!! TODO
            "use strict";
            let template = '<div class="panel panel-default"><div class="panel-heading">' +
                '<h3 class="panel-title">{T}</h3></div><div class="panel-body">{B}</div></div>';
            let content = document.getElementById('content');

            let newHTML = '<div class="alert alert-success" id="alert" style="display:none">Your parameters have been saved.</div>';
            newHTML += template.replace('{T}', 'Script installed!').replace('{B}', '<p>Congratulations! SteamTrade Matcher\'s Userscript is up and running!</p>');

            newHTML += template.replace('{T}', 'Trade offer message').replace('{B}', '<p>Custom text that will be included automatically with your trade offers created through STM while using this userscript. To remove this functionality, simply delete the text.</p><div><input type="text" name="trade-message" id="trade-message" class="form-control" value="' + g_s.MESSAGE + '"></div>');

            newHTML += template.replace('{T}', 'Action after trade').replace('{B}', '<p>Determines what happens when you complete a trade offer.</p><ul><li><strong>Do nothing</strong>: Will do nothing more than the normal behavior.</li><li><strong>Close window</strong>: Will close the window after the trade offer is sent.</li><li><strong>Click OK</strong>: Will redirect you to the trade offers recap page.</li></ul><div class="option-block"><label for="after-trade">After trade...</label><select class="form-control" name="after-trade" id="after-trade"><option value="NOTHING">Do Nothing</option><option value="CLOSE_WINDOW">Close window</option><option value="CLICK_OK">Click OK</option></select></div>').replace(g_s.DO_AFTER_TRADE, g_s.DO_AFTER_TRADE + '" selected="');

            newHTML += template.replace('{T}', 'Cards order').replace('{B}', '<p>Determines which card is added to trade.</p><ul><li><strong>Sorted</strong>: Will sort cards by their IDs before adding to trade. If you make several trade offers with the same card and one of them is accepted, the rest will have message "cards unavilable to trade".</li><li><strong>Random</strong>: Will add cards to trade randomly. If you make several trade offers and one of them is accepted, only some of them will be unavilable for trade.</li><li><strong>As is</strong>: Script doesn\'t change anything in order. Results vary depending on browser, steam servers, weather...</li></ul><div class="option-block"><label for="cards-order">Cards order</label><select class="form-control" name="cards-order" id="cards-order"><option value="SORT">Sorted</option><option value="RANDOM">Random</option><option value="AS_IS">As is</option></select></div>').replace(g_s.ORDER, g_s.ORDER + '" selected="');

            newHTML += template.replace('{T}', 'Update users\' escrow status').replace('{B}', '<p>Help STM by sending escrow status of users you are trading with.</p><div class="checkbox"><label for="check-escrow"><input name="check-escrow" id="check-escrow" value="1" type="checkbox"' + (g_s.CHECK_ESCROW
        ? ' checked="checked"'
        : '') + '> Enable</label></div>');

            newHTML += template.replace('{T}', 'Auto-send trade offer').replace('{B}', '<p>Makes it possible for the script to automatically send trade offers without any action on your side. This is not recommended as you should always check your trade offers, but, well, this is a possible thing. Please note that incomplete trade offers (missing cards, ...) won\'t be sent automatically even when this parameter is set to true.</p><div class="checkbox"><label for="auto-send"><input name="auto-send" id="auto-send" value="1" type="checkbox"' + (g_s.AUTO_SEND
        ? ' checked="checked"'
        : '') + '> Enable</label></div>');

            newHTML += '<div id="save" style="margin-bottom:20px"><input class="btn btn-default btn-block" id="save-button" value="Save" type="submit"></div>';
            newHTML += '<div id="restore" style="margin-bottom:20px"><input class="btn btn-default btn-block" id="restore-button" value="Restore default settings" type="submit"></div>';

            content.innerHTML = newHTML + content.innerHTML;
            document.getElementById('save').addEventListener("click", saveSettings, false);
            document.getElementById('restore').addEventListener("click", restoreDefaultSettings, false);
        }

        try {

            let global_settings = JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM.Settings"));
            if (global_settings === null) {
                global_settings = new Object();
                global_settings.MESSAGE = 'ASF STM Matcher';
                global_settings.AUTO_SEND = false;
                global_settings.DO_AFTER_TRADE = 'NOTHING';
                global_settings.ORDER = 'AS_IS';
            }

        // get cards data from URL

            let vars = getUrlVars();

            let Cards = [
                (vars.you
                 ? vars.you.split(';').map(elem => ParseCard(elem))
                 : []),
                (vars.them
                 ? vars.them.split(';').map(elem => ParseCard(elem))
                 : [])
            ];

            if (Cards[0].length !== Cards[1].length) {
                unsafeWindow.ShowAlertDialog(
                    'Different items amount',
                    'You\'ve requested ' + (Cards[0].length > Cards[1].length
                                            ? 'less'
                                            : 'more') + ' items than you give. Script aborting.'
                );
                throw ('Different items amount on both sides');
            }

            // clear cookie containing last opened inventory tab - prevents unwanted inventory loading (it will be restored later)
            let oldCookie = document.cookie.split('strTradeLastInventoryContext=')[1];
            if (oldCookie) {
                oldCookie = oldCookie.split(';')[0];
            }
            document.cookie = 'strTradeLastInventoryContext=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/tradeoffer/';

            let Users = [unsafeWindow.UserYou, unsafeWindow.UserThem];
            let global_vars = {"Users": Users, "oldCookie": oldCookie, "Cards": Cards};

            window.setTimeout(checkContexts, 500, global_settings, global_vars);
        } catch (e) {
            console.log(e);
        }
    }
})();
