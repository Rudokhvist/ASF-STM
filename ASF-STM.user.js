// ==UserScript==
// @name        ASF STM DEV
// @language    English
// @namespace   https://greasyfork.org/users/2205
// @description ASF bot list trade matcher
// @license     Apache-2.0
// @author      Ryzhehvost
// @include     http*://steamcommunity.com/id/*/badges
// @include     http*://steamcommunity.com/id/*/badges/
// @include     http*://steamcommunity.com/profiles/*/badges
// @include     http*://steamcommunity.com/profiles/*/badges/
// @version     2.1
// @connect     asf.justarchi.net
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// ==/UserScript==

(function() {
    "use strict";
    //configuration
    const weblimiter = 300;
    const errorLimiter = 30000;
    const debug = false;
    const maxErrors = 3;
    const filterBackgroundColor = 'rgba(23, 26, 33, 0.8)';//'rgba(103, 193, 245, 0.8)';

    //do not change
    let myProfileLink = 0;
    let errors = 0;
    let bots;
    let myBadges = [];
    let botBadges = [];
    let maxPages;
    let stop = false;
    let classIdsDB = JSON.parse(localStorage.getItem("Ryzhehvost.ASF.STM"));
    if (classIdsDB === null) {
        classIdsDB = new Object();
    }

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
            console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit",second: "2-digit", fractionalSecondDigits: 3}) + " : " + msg);
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

    function getClassID(index,cardnumber) {
        debugPrint("card number "+cardnumber);
        updateMessage("Updating cards database for badge " + (index + 1) + " of " + myBadges.length);
        if (classIdsDB.hasOwnProperty(myBadges[index].appId) && classIdsDB[myBadges[index].appId].hasOwnProperty(myBadges[index].cards[cardnumber].item)) {
            //don't update if we already have this data; continue with rest of classes
            cardnumber++;
            if (cardnumber >= myBadges[index].maxCards) {
                cardnumber=0;
                index++;
            }
            debugPrint("index "+index+" length "+ myBadges.length);
            if (index < myBadges.length) {
                getClassID(index,cardnumber);
            } else {
                debugPrint(JSON.stringify(classIdsDB));
                localStorage.setItem("Ryzhehvost.ASF.STM",JSON.stringify(classIdsDB));
                setTimeout(function() {
                    GetCards(0, 0);
                }, weblimiter);
            }
            return;
        }

        let hashName = myBadges[index].cards[cardnumber].hash;
        if (hashName == null) {
            hashName = myBadges[index].appId +"-"+ myBadges[index].cards[cardnumber].item;
        }
        let marketUrl = "https://steamcommunity.com/market/listings/753/"+encodeURI(hashName);
        let xhr = new XMLHttpRequest();
        xhr.open("GET", marketUrl, true);
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
                debugPrint("getting classid for " + hashName);
                let classRegex = /"classid":"(\d+)"/g;
                let match = classRegex.exec(xhr.response.documentElement.outerHTML);
                if (match != null && match.length > 1) {
                    errors = 0;
                    let classid = match[1];
                    if (classIdsDB[myBadges[index].appId] === undefined) {
                        classIdsDB[myBadges[index].appId] = new Object();
                    }
                    let cardsClasses = classIdsDB[myBadges[index].appId];
                    cardsClasses[myBadges[index].cards[cardnumber].item] = classid;
                    if (myBadges[index].cards[cardnumber].hash == null) {
                        myBadges[index].cards[cardnumber].hash = hashName;
                    }
                } else {
                    if (myBadges[index].cards[cardnumber].hash == null) { //maybe we've got wrong hash, let's fix it
                        setTimeout((function(index,cardnumber) {
                            return function() {
                                searchHashName(index,cardnumber);
                            };
                        })(index,cardnumber), weblimiter);
                        return;
                    } else {
                        updateMessage("Error getting card classid, please report this!");
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }
                }
                //continue with rest of classes
                cardnumber++;
                if (cardnumber >= myBadges[index].maxCards) {
                    cardnumber=0;
                    index++;
                }
                debugPrint("index "+index+" length "+ myBadges.length);
                if (index < myBadges.length) {
                    setTimeout((function(index,cardnumber) {
                        return function() {
                            getClassID(index,cardnumber);
                        };
                    })(index, cardnumber), weblimiter+errorLimiter*errors);
                    return;
                } else {
                    debugPrint(JSON.stringify(classIdsDB));
                    localStorage.setItem("Ryzhehvost.ASF.STM",JSON.stringify(classIdsDB));
                    setTimeout(function() {
                            GetCards(0, 0);
                    }, weblimiter);
                    return;
                }
            } else {
                errors++;
                if (myBadges[index].cards[cardnumber].hash == null) { //maybe we've got wrong hash, let's fix it
                    setTimeout((function(index,cardnumber) {
                        return function() {
                            searchHashName(index,cardnumber);
                        };
                    })(index,cardnumber), weblimiter);
                    return;
                }
            }
            if ((status < 400 || status >= 500) && (errors <= maxErrors)) {
                setTimeout((function(index,cardnumber) {
                    return function() {
                        getClassID(index,cardnumber);
                    };
                })(index,cardnumber), weblimiter+errorLimiter*errors);
            } else {
                if (status != 200) {
                    updateMessage("Error getting classid data, ERROR " + status);
                } else {
                    updateMessage("Error getting classid data, malformed HTML");
                }
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
                setTimeout((function(index,cardnumber) {
                    return function() {
                        getClassID(index,cardnumber);
                    };
                })(index,cardnumber), weblimiter+errorLimiter*errors);
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
    }


    function searchHashName(index,cardnumber) {
        debugPrint("searchHashName for " + myBadges[index].cards[cardnumber].item + " from " + myBadges[index].appId);
        let searchUrl="https://steamcommunity.com/market/search?q="+myBadges[index].cards[cardnumber].item.replace(/\s/g, "+")+"&category_753_Game[]=tag_app_"+myBadges[index].appId+"&category_753_cardborder[]=tag_cardborder_0&appid=753"
        debugPrint(searchUrl);
        let xhr = new XMLHttpRequest();
        xhr.open("GET", searchUrl, true);
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
                debugPrint("getting hashName for " + myBadges[index].cards[cardnumber].item);
                let results = xhr.response.documentElement.querySelectorAll(".market_listing_row");
                for (let i = 0; i < results.length; i++) {
                    //if (results[i].querySelector(".market_listing_item_img").srcset.includes(myBadges[index].cards[cardnumber].icon)) {
                    if (results[i].querySelector(".market_listing_item_name").textContent.trim().startsWith(myBadges[index].cards[cardnumber].item)) {
                         myBadges[index].cards[cardnumber].hash = results[i].getAttribute("data-hash-name");
                        debugPrint(myBadges[index].cards[cardnumber].hash);
                        break;
                    }
                }
                if (myBadges[index].cards[cardnumber].hash === null || myBadges[index].cards[cardnumber].hash === "") {
                    errors++;
                    if (errors <= maxErrors) { //something went wrong, let's retry...
                        setTimeout((function(index,cardnumber) {
                            return function() {
                                searchHashName(index,cardnumber);
                            };
                        })(index,cardnumber), weblimiter+errorLimiter*errors);
                    } else {
                        updateMessage("Error getting hashName for card " + myBadges[index].cards[cardnumber].item + " from "+ myBadges[index].appId + ", please report this!");
                        hideThrobber();
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    }
                }
                //try again with correct hash name
                errors = 0;
                setTimeout((function(index,cardnumber) {
                    return function() {
                        getClassID(index,cardnumber);
                    };
                })(index,cardnumber), weblimiter+errorLimiter*errors);
                return;
            } else {
                errors++;
            }
            if ((status < 400 || status >= 500) && (errors <= maxErrors)) {
                setTimeout((function(index,cardnumber) {
                    return function() {
                        searchHashName(index,cardnumber);
                    };
                })(index,cardnumber), weblimiter+errorLimiter*errors);
            } else {
                if (status != 200) {
                    updateMessage("Error getting hashName, ERROR " + status);
                } else {
                    updateMessage("Error getting hashName, malformed HTML");
                }
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
                setTimeout((function(index,cardnumber) {
                    return function() {
                        searchHashName(index,cardnumber);
                    };
                })(index,cardnumber), weblimiter+errorLimiter*errors);
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
    }

    function populateCards(item) {
        let classList = "";
        let htmlCards = "";
        for (let j = 0; j < item.cards.length; j++) {
            let itemIcon = item.cards[j].iconUrl+"/98x115";
            let itemName = item.cards[j].item.substring(item.cards[j].item.indexOf("-") + 1);
            for (let k = 0; k < item.cards[j].count; k++) {
                if (classList != "") {
                    classList += ";";
                }
                classList += classIdsDB[item.appId][item.cards[j].item];
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
                classes += classIdsDB[item.appId][item.cards[j].item];
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
        //let filterWidget = document.getElementById("asf_stm_filters_body");
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
        let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=" + getPartner(bots[index].SteamID) + "&token=" + bots[index].TradeToken + "&source=stm";
        let globalYou = "";
        let globalThem = "";
        let matches = "";
        let any = "";
        if (bots[index].MatchEverything == 1) {
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

            let tradeUrlApp = tradeUrl + "&them=" + receiveResult.classList + "&you=" + sendResult.classList;

            let matchTemplate = `
                  <div class="asf_stm_appid_${appId}" style="display:${display}">
                    <div class="badge_row is_link goo_untradable_note showcase_slot">
                      <div class="notLoggedInText">
                        <img alt="${gameName}" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg">
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
                        <a class="full_trade_url" href="${tradeUrlFull}" target="_blank" rel="noopener noreferrer" >Offer a trade for all</a>
                      </span>
                    </div>
                  </div>
                  <div style="float: left;" class="">
                    <div class="user_avatar playerAvatar online">
                      <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/profiles/${bots[index].SteamID}">
                        <img src="https://avatars.cloudflare.steamstatic.com/${bots[index].AvatarHash}.jpg" />
                      </a>
                     </div>
                  </div>
                  <div class="badge_title">
                    <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/profiles/${bots[index].SteamID}">${botname}</a>${any}
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

        debugPrint("bot's cards");
        debugPrint(JSON.stringify(botBadges));
        debugPrint("our cards");
        debugPrint(JSON.stringify(myBadges));

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
                        let myInd = myBadge.cards.findIndex(a => a.item == theirBadge.cards[j].item); //index of slot where we receive card
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
                                    if (bots[index].MatchEverything == 0) { //make sure it's neutral+ for them
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
                                        "class": classIdsDB[myBadge.appId][myBadge.cards[k].item],
                                        "iconUrl": myBadge.cards[k].iconUrl
                                    };
                                    let itemToReceive = {
                                        "item": theirBadge.cards[j].item,
                                        "count": 1,
                                        "class": classIdsDB[theirBadge.appId][theirBadge.cards[j].item],
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
        debugPrint(JSON.stringify(itemsToSend));
        debugPrint("items to receive");
        debugPrint(JSON.stringify(itemsToReceive));
        bots[index].itemsToSend = itemsToSend;
        bots[index].itemsToReceive = itemsToReceive;
        if (itemsToSend.length > 0) {
            //getUsername(index, callback);
            addMatchRow(index, bots[index].Nickname);
            callback();
        } else {
            debugPrint("no matches");
            callback();
        }
    }

    function GetCards(index, userindex) {
        debugPrint("GetCards "+index+" : "+userindex);
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
                profileLink = "profiles/" + bots[userindex].SteamID;
                updateMessage("Fetching bot " + (userindex + 1).toString() + " of " + bots.length.toString()+" (badge " + (index + 1) + " of " + botBadges.length+")");
                updateProgress(userindex);
            }

            let url = "https://steamcommunity.com/" + profileLink + "/gamecards/" + botBadges[index].appId + "?l=english";
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
                    debugPrint("processing badge " + botBadges[index].appId);
                    let badgeCards = xhr.response.documentElement.querySelectorAll(".badge_card_set_card");
                    if (badgeCards.length >= 5) {
                        errors = 0;
                        botBadges[index].maxCards = badgeCards.length;
                        for (let i = 0; i < badgeCards.length; i++) {
                            let quantityElement = badgeCards[i].querySelector(".badge_card_set_text_qty");
                            let quantity = (quantityElement == null)? "(0)": quantityElement.innerText.trim();
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
                                "item": name,
                                "hash": null,
                                "count": Number(quantity),
                                "iconUrl": icon
                            };
                            debugPrint(JSON.stringify(newcard));
                            botBadges[index].cards.push(newcard);
                        }


                        index++;
                        setTimeout((function(index, userindex) {
                            return function() {
                                GetCards(index, userindex);
                            };
                        })(index, userindex), weblimiter);
                        return;
                    } else { //if can't find any cards on badge page - retry, that's must be a bug.
                        debugPrint(xhr.response.documentElement.outerHTML);
                        errors++;
                    }
                } else {
                    errors++;
                }
                if ((status < 400 || status >= 500) && (errors <= maxErrors)) {
                        setTimeout((function(index,userindex) {
                            return function() {
                                GetCards(index,userindex);
                            };
                        })(index,userindex), weblimiter+errorLimiter*errors);
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
                        setTimeout((function(index,userindex) {
                            return function() {
                                GetCards(index,userindex);
                            };
                        })(index,userindex), weblimiter+errorLimiter*errors);
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
            debugPrint("badge "+i+JSON.stringify(botBadges[i]));

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
            debugPrint("totalCards="+totalCards+" maxSets="+botBadges[i].maxSets+" lastSet="+botBadges[i].lastSet);
        }
        debugTimeEnd("Filter and sort");

        if (userindex < 0) {
            myBadges = deepClone(botBadges);
            getClassID(0,0);
        } else {
            debugPrint(bots[userindex].SteamID);
            compareCards(userindex, function() {
                if (userindex < bots.length - 1) {
                    setTimeout((function(userindex) {
                        return function() {
                            GetCards(0, userindex);
                        };
                    })(userindex + 1), weblimiter);
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
        }

    }

    function getBadges(page) {
        let url = "https://steamcommunity.com/" + myProfileLink + "/badges?p=" + page + "&l=english";
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
                        if (!badges[i].parentElement.querySelector(".badge_row_overlay").href.endsWith("border=1")){ //ignore foil badges completely so far.
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
                                        "appId": appId,
                                        "title": title,
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
                    })(page), weblimiter+errorLimiter*errors);
                } else {
                    debugPrint("all badge pages processed");
                    debugPrint(weblimiter+errorLimiter*errors);
                    if (myBadges.length === 0) {
                        hideThrobber();
                        updateMessage("No cards to match");
                        enableButton();
                        let stopButton = document.getElementById("asf_stm_stop");
                        stopButton.remove();
                        return;
                    } else {
                        setTimeout(function() {
                                GetCards(0,-1);
                            }, weblimiter+errorLimiter*errors);
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
                })(page), weblimiter+errorLimiter*errors);
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
        let profileRegex = /http[s]?:\/\/steamcommunity.com\/(.*)\/badges.*/g;
        let result = profileRegex.exec(document.location);
        if (result) {
            myProfileLink = result[1];
        } else { //should never happen, but whatever.
            myProfileLink = "my"
        }

        debugPrint(profileRegex);

        let requestUrl = "https://asf.justarchi.net/Api/Listing/Bots"; //"https://asf.justarchi.net/Api/Bots";
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
                let re = /("SteamID":)(\d+)/g;
                let fixedJson = response.response.replace(re, "$1\"$2\""); //because fuck js
                bots = JSON.parse(fixedJson).Result;
                //bots.filter(bot=>bot.matchable_cards===1||bot.matchable_foil_cards===1);  //I don't think this is really needed
                bots.sort(function(a, b) { //sort received array as I like it. TODO: sort according to settings
                    let result = b.MatchEverything - a.MatchEverything; //bots with MatchEverything go first
                    if (result === 0) {
                        result = b.TotalGamesCount - a.TotalGamesCount; //then by TotalGamesCount descending
                    }
                    if (result === 0) {
                        result = b.TotalItemsCount - a.TotalItemsCount; //then by TotalItemsCounts descending
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
