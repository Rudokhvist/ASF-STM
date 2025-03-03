/* HTML */`
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
        <a href="${tradeUrlApp}" target="_blank" rel="noopener noreferrer">
            <div class="btn_darkblue_white_innerfade btn_medium">
                <span>Offer a trade</span>
            </div>
        </a>
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
        <a href="https://steamcommunity.com/${botProfileLink}/gamecards/${appId}/" target="_blank" rel="noopener noreferrer">
            <div class="badge_info_unlocked profile_xp_block_mid avatar_block_status_online badge_info_title badge_row_overlay ellipsis" style="height: 15px;">
                ${sanitizeNickname(bots.Result[index].Nickname)}
            </div>
        </a>
        ${receiveResult}
    </div>
</div>
</div>
`