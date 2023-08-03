interface Apps {
    [key: number]: Contexts;
}

interface Asset {
    element: HTMLElement;
    icon_url: string;
    icon_url_large: string;
    id: string;
    market_fee_app: string;
    market_hash_name: string;
    name: string;
    tags: Tag[];
    type: string;
}

interface Assets {
    // TODO: `Object.values` return type `any` when passing an object defined as
    // having `number` keys
    // https://github.com/Microsoft/TypeScript/issues/26010
    [key: string]: Asset;
}

interface Bot {
    MatchEverything: boolean;
    SteamID: number;
}

interface Bots {
    Message: string;
    Result: Bot[];
    Success: boolean;
    cacheTime: number;
}

interface Card {
    appid: string;
    hash: string;
    id: string;
    name: string;
}

interface CardThem extends Card {}

interface CardYou extends Card {}

interface Context {
    inventory: Inventory;
}

interface Contexts {
    [key: number]: Context;
}

interface GlobalSettings {
    autoSend: boolean;
    debug: boolean;
    doAfterTrade: "CLICK_OK" | "CLOSE_WINDOW" | "NOTHING";
    order: "AS_IS" | "RANDOM" | "SORT";
}

interface GlobalVars {
    Cards: [CardYou[], CardThem[]];
    Users: User[];
    oldCookie: string;
}

interface Inventory {
    BuildInventoryDisplayElements: () => void;
    rgInventory: Assets;
}

interface Tag {
    category: string;
    internal_name: string;
}

interface TmpCard {
    element: Asset["element"];
    id: Asset["id"];
    type: Asset["type"];
}

interface TmpCards {
    [key: string]: TmpCard[];
}

interface User {
    rgContexts: Apps;
}
