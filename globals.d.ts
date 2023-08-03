declare const GM: {
    xmlHttpRequest(details: GM.Request): void;
};

declare const unsafeWindow: typeof window;

declare const GM_xmlhttpRequest: typeof GM.xmlHttpRequest;

declare namespace GM {
    interface Request<TContext = any> {
        method: "GET" | "POST";
        url: string;
        onabort(response: Response<TContext>): void;
        onerror(response: Response<TContext>): void;
        onload(response: Response<TContext>): void;
        ontimeout(response: Response<TContext>): void;
    }

    interface Response<TContext> {
        readonly response: string;
        readonly status: number;
    }
}

interface TradeOfferStateManager {
    ConfirmTradeOffer: () => void;
}

interface Window {
    CTradeOfferStateManager: TradeOfferStateManager;
    MoveItemToTrade: (elItem: HTMLElement) => void;
    ShowAlertDialog: (strTitle: string, strDescription: string) => void;
    ToggleReady: (bReady: boolean) => void;
}
