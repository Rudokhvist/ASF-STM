/* HTML */`
<div id="asfstmbot_${index}" class="badge_row">
<div class="badge_row_inner">
    <div class="badge_title_row guide_showcase_contributors">
        <div class="badge_title_stats">
            <a class="filter_all" target="_blank" rel="noopener noreferrer" style="margin-right: 1em">
                <div class="btn_darkblue_white_innerfade btn_medium" data-appids="${appIdList.join()}">
                    <span data-appids="${appIdList.join()}">Filter All</span>
                </div>
            </a>
            <a class="full_trade_url" href="${tradeUrlFull}" target="_blank" rel="noopener noreferrer">
                <div class="btn_darkblue_white_innerfade btn_medium">
                    <span>Offer a trade for all</span>
                </div>
            </a>
        </div>
        <div style="float: left;" class="">
            <div class="user_avatar playerAvatar online">
                <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${botProfileLink}">
                    <img src="https://avatars.cloudflare.steamstatic.com/${bots.Result[index].AvatarHash === null ? "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb" : bots.Result[index].AvatarHash}.jpg" />
                </a>
            </div>
        </div>
        <div class="badge_title">
            &nbsp;<a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${botProfileLink}">${sanitizeNickname(bots.Result[index].Nickname)}</a>${any}
            &ensp;<span style="color: #8F98A0;">(${bots.Result[index].TotalInventoryCount} items)</span>
            &ensp;<a id="blacklist_${bots.Result[index].SteamID}" data-tooltip-text="Blacklist this bot" class="tooltip hover_tooltip">
                <img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconForumBan.png?v=1">
            </a>
        </div>
    </div>
    <div class="badge_title_rule"></div>
    ${matches}
</div>
</div>
`