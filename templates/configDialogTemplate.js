/* HTML */`
<div class="asf-stm-config">
<ul class="asf_stm_tabs" style="margin: 0;padding: 0;">
    <li class="asf_stm_tab">
        <input type="radio" id="asf_stm_tab1" name="asf_stm_tabs" checked>
        <label for="asf_stm_tab1">Matcher</label>
        <div id="asf_stm_tab-content1" class="asf_stm_content">
            <fieldset>
                <legend>MATCH FRIENDS</legend>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Match with friends (only public inventories)</span>
                    <input type="checkbox" id="matchFriends" ${globalSettings.matchFriends ? 'checked' : ''} class="asf-stm-checkbox">
                </div>
            </fieldset>

            <fieldset>
                <legend>BOTS TO MATCH</legend>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Match with "Any" bots</span>
                    <input type="checkbox" id="anyBots" ${globalSettings.anyBots ? 'checked' : ''} class="asf-stm-checkbox">
                    <br>
                    <span class="asf-stm-margin-right">Match with "Fair" bots</span>
                    <input type="checkbox" id="fairBots" ${globalSettings.fairBots ? 'checked' : ''} class="asf-stm-checkbox">
                </div>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Minimum items:</span>
                    <input type="number" id="botMinItems" value=${globalSettings.botMinItems} min="0" class="asf-stm-input">
                    <br>
                    <span class="asf-stm-margin-right">Maximum items:</span>
                    <input type="number" id="botMaxItems" value=${globalSettings.botMaxItems} min="0" class="asf-stm-input">
                    <a class="tooltip hover_tooltip" data-tooltip-text="Don't match with bots that has less or more than required limit of items in steam inventory. 0 means no limit on number of items">
                        <img src="${questionmarkURL}">
                    </a>
                </div>
                <div class="asf-stm-margin-bottom">
                    ${Array.from({ length: 4 }, (_, i) => createSortSelect(i)).join('')}
                </div>
            </fieldset>

            <fieldset>
                <legend>INTERFACE</legend>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Game filter pop-up background color:</span>
                    <input type="color" id="filterBackgroundColor" value="${filterBG[0]}" class="asf-stm-input" style="margin-right: 1.5em;">
                    <span class="asf-stm-margin-right">opacity:</span>
                    <input type="range" id="filterBackgroundAlpha" value=${filterBG[1]} min=0 max=1 step=0.01 class="asf-stm-range" style="height: 4px;">
                    <br>
                </div>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Sort results by game name</span>
                    <input type="checkbox" id="sortByName" class="asf-stm-checkbox" ${globalSettings.sortByName ? 'checked' : ''}>
                </div>
            </fieldset>

            <fieldset style="display: grid;grid-template-columns: repeat(2, 1fr);grid-template-rows: repeat(3, 1fr);gap: 12px;">
                <legend>SETTINGS</legend>
                <fieldset style="grid-row: span 3 / span 3;grid-column-start: 2;grid-row-start: 1;">
                    <legend>DEVELOPER</legend>
                    <div>
                        <span class="asf-stm-margin-right">Debug</span>
                        <input type="checkbox" id="debug" ${globalSettings.debug ? 'checked' : ''} class="asf-stm-checkbox">
                        <a class="tooltip hover_tooltip" data-tooltip-text="Enable additional output to console">
                            <img src="${questionmarkURL}">
                        </a>
                    </div>
                </fieldset>

                <div>
                    <span class="asf-stm-span">Web limiter delay (ms):</span>
                    <input type="number" id="weblimiter" value= ${globalSettings.weblimiter} min=0 class="asf-stm-input">
                </div>
                <div style="grid-column-start: 1;grid-row-start: 2;">
                    <span class="asf-stm-span">Delay on error (ms):</span>
                    <input type="number" id="errorLimiter" value=${globalSettings.errorLimiter} min=0 class="asf-stm-input">
                </div>
                <div style="grid-column-start: 1;grid-row-start: 3;">
                    <span class="asf-stm-span">Max errors:</span>
                    <input type="number" id="maxErrors" value=${globalSettings.maxErrors} min=0 class="asf-stm-input">
                </div>
            </fieldset>
        </div>
    </li>

    <li class="asf_stm_tab">
        <input type="radio" id="asf_stm_tab2" name="asf_stm_tabs">
        <label for="asf_stm_tab2">Trade helper</label>
        <div id="asf_stm_tab-content2" class="asf_stm_content">
            <fieldset>
                <legend>TRADE OFFER MESSAGE</legend>
                <textarea id="tradeMessage" name="tradeMessage" rows="4" cols="60" class="asf-stm-textarea">
                    ${globalSettings.tradeMessage}
                </textarea>
                <a class="tooltip hover_tooltip" data-tooltip-text="Custom text that will be included automatically with your trade offers created through STM while using this userscript. To remove this functionality, simply delete the text.">
                    <img src="${questionmarkURL}">
                </a>
            </fieldset>

            <fieldset>
                <legend>ACTION AFTER TRADE</legend>
                <label for="after-trade" class="asf-stm-margin-right">After trade...</label>
                <select id="doAfterTrade" name="after-trade" class="asf-stm-select asf-stm-margin-bottom">
                    <option value="NOTHING" ${globalSettings.doAfterTrade === "NOTHING" ? 'selected' : ''}>Do Nothing</option>
                    <option value="CLOSE_WINDOW" ${globalSettings.doAfterTrade === "CLOSE_WINDOW" ? 'selected' : ''}>Close window</option>
                    <option value="CLICK_OK" ${globalSettings.doAfterTrade === "CLICK_OK" ? 'selected' : ''}>Click OK</option>
                </select>
                <a class="tooltip hover_tooltip" data-tooltip-html="<p>Determines what happens when you complete a trade offer.</p><ul><li><strong>Do nothing</strong>: Will do nothing more than the normal behavior.</li><li><strong>Close window</strong>: Will close the window after the trade offer is sent.</li><li><strong>Click OK</strong>: Will redirect you to the trade offers recap page.</li></ul>">
                    <img src="${questionmarkURL}">
                </a>
            </fieldset>

            <fieldset>
                <legend>CARDS OFFER</legend>
                <label for="cards-order" class="asf-stm-margin-right">Cards order</label>
                <select id="order" name="cards-order" class="form-control asf-stm-select asf-stm-margin-bottom">
                    <option value="SORT" ${globalSettings.order === "SORT" ? 'selected' : ''}>Sorted</option>
                    <option value="RANDOM" ${globalSettings.order === "RANDOM" ? 'selected' : ''}>Random</option>
                    <option value="AS_IS" ${globalSettings.order === "AS_IS" ? 'selected' : ''}>As is</option>
                </select>
                <a class="tooltip hover_tooltip" data-tooltip-html="<p>Determines which card is added to trade.</p><ul><li><strong>Sorted</strong>: Will sort cards by their IDs before adding to trade. If you make several trade offers with the same card and one of them is accepted, the rest will have message &quot;cards unavilable to trade&quot;.</li><li><strong>Random</strong>: Will add cards to trade randomly. If you make several trade offers and one of them is accepted, only some of them will be unavilable for trade.</li><li><strong>As is</strong>: Script doesn't change anything in order. Results vary depending on browser, steam servers, weather...</li></ul>">
                    <img src="${questionmarkURL}">
                </a>
            </fieldset>

            <fieldset>
                <legend>AUTO-SEND TRADE OFFER</legend>
                <div class="asf-stm-margin-bottom">
                    <label for="auto-send" class="asf-stm-margin-right">Enable</label>
                    <input type="checkbox" id="autoSend" name="auto-send" value="1" ${globalSettings.autoSend ? 'checked' : ''} class="asf-stm-checkbox asf-stm-margin-bottom">
                    <a class="tooltip hover_tooltip" data-tooltip-text="Makes it possible for the script to automatically send trade offers without any action on your side. This is not recommended as you should always check your trade offers, but, well, this is a possible thing. Please note that incomplete trade offers (missing cards, ...) won't be sent automatically even when this parameter is set to true.">
                        <img src="${questionmarkURL}">
                    </a>
                </div>
            </fieldset>
        </div>
    </li>

    <li class="asf_stm_tab">
        <input type="radio" id="asf_stm_tab3" name="asf_stm_tabs">
        <label for="asf_stm_tab3">Blacklist</label>
        <div id="asf_stm_tab-content3" class="asf_stm_content">
            <div class="title_text profile_xp_block_remaining">
                <h1 style="margin: 0.5em;">Comma-separated list of ignored steamIDs</h1>
                <textarea class="asf-stm-textarea" id="blacklist" name="Blacklist" rows="17" cols="63">
                    ${arrayToText(blacklist)}
                </textarea>
            </div>
        </div>
    </li>

    <li class="asf_stm_tab">
        <input type="radio" id="asf_stm_tab4" name="asf_stm_tabs">
        <label for="asf_stm_tab4">Scan filters</label>
        <div class="asf_stm_content" id="asf_stm_tab-content4">
            <fieldset>
                <legend>SETTINGS</legend>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">Use scan filters</span>
                    <input type="checkbox" id="useScanFilters" ${globalSettings.useScanFilters ? 'checked' : ''} class="asf-stm-checkbox">
                    <a class="tooltip hover_tooltip" data-tooltip-text="Filter badges to cut short the duration of the scan.">
                        <img src="${questionmarkURL}">
                    </a>
                    <br>
                    <span class="asf-stm-margin-right">Auto add new scan filters</span>
                    <input type="checkbox" id="autoAddScanFilters" ${globalSettings.autoAddScanFilters ? 'checked' : ''} class="asf-stm-checkbox">
                    <a class="tooltip hover_tooltip" data-tooltip-text="Add new scan filters from a fresh scan (clear all your filters).">
                        <img src="${questionmarkURL}">
                    </a>
                    <br>
                    <span class="asf-stm-margin-right">Auto delete old scan filters</span>
                    <input type="checkbox" id="autoDeleteScanFilters" ${globalSettings.autoDeleteScanFilters ? 'checked' : ''} class="asf-stm-checkbox">
                    <a class="tooltip hover_tooltip" data-tooltip-text="Delete scan filters from badges without duplicates.">
                        <img src="${questionmarkURL}">
                    </a>
                </div>
            </fieldset>

            <fieldset>
                <legend>MANAGE SCAN FILTERS</legend>
                <div class="asf-stm-margin-bottom">
                    <span class="asf-stm-margin-right">App Id:</span>
                    <input type="number" id="addScanFilterAppId" step="10" required class="asf-stm-input asf-stm-margin-right appid-validity">
                    <button id="addScanFilterButton" class="btn_blue_steamui btn_small asf-stm-margin-right"><span>Add scan filter</span></button>
                    <span id="addScanFilterStatus"></span>
                </div>
                <div class="asf-stm-margin-bottom">
                    <button onclick="document.querySelector('#clearScanFilters').style.visibility = 'visible'" class="btn_plum btn_small asf-stm-margin-right"><span>Clear scan filters</span></button>
                    <button id="clearScanFilters" class="btn_darkred_white_innerfade btn_small" style="visibility: hidden;"><span>Are you sure?</span></button>
                </div>
            </fieldset>

            <fieldset>
                <legend>FILTERS</legend>
                <div id="asf-stm-filters" style="column-gap: 4px;display: flex;flex-wrap: wrap;justify-content: flex-start;">
                    ${scanFiltersTemplate}
                </div>
            </fieldset>
        </div>
    </li>
</ul>
</div>
`