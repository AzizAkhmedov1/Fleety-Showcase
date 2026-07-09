const GOOGLE_MAPS_SCRIPT_ID = "google-maps-script";
const LEGACY_RADAR_SCRIPT_ID = "google-maps-radar-script";
const GOOGLE_MAPS_LIBRARIES = "places,geometry";
const GOOGLE_MAPS_CALLBACK_NAME = "__tmsGoogleMapsCallback";
export const GOOGLE_MAPS_LOAD_TIMEOUT_MS = 20000;
const RESOLVED_PROMISE = Promise.resolve();
let inflightPromise: Promise<void> | null = null;
type GoogleMapsCallbackWindow = Window & {
    [GOOGLE_MAPS_CALLBACK_NAME]?: () => void;
};
export function isGoogleMapsCoreReady(): boolean {
    return typeof window !== "undefined" && Boolean(window.google?.maps);
}
export function isGoogleMapsEnvironmentReady(_requireVisualization = false): boolean {
    return isGoogleMapsCoreReady();
}
function buildGoogleMapsScriptUrl(apiKey: string): string {
    const params = new URLSearchParams({
        key: apiKey,
        libraries: GOOGLE_MAPS_LIBRARIES,
        loading: "async",
        callback: GOOGLE_MAPS_CALLBACK_NAME,
    });
    return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}
function isCompatibleGoogleMapsScript(script: HTMLScriptElement): boolean {
    return (script.src.includes("maps.googleapis.com/maps/api/js") &&
        script.src.includes("places") &&
        script.src.includes("loading=async"));
}
function createGoogleMapsLoadPromise(apiKey: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const settleResolve = () => {
            if (settled)
                return;
            settled = true;
            resolve();
        };
        const settleReject = (message: string) => {
            if (settled)
                return;
            settled = true;
            inflightPromise = null;
            reject(new Error(message));
        };
        const finishReady = () => {
            if (isGoogleMapsCoreReady()) {
                settleResolve();
                return;
            }
            settleReject("Google Maps script loaded but window.google.maps is unavailable.");
        };
        const timeoutId = window.setTimeout(() => {
            if (!isGoogleMapsCoreReady()) {
                settleReject(`Google Maps SDK did not become ready within ${GOOGLE_MAPS_LOAD_TIMEOUT_MS / 1000}s.`);
            }
        }, GOOGLE_MAPS_LOAD_TIMEOUT_MS);
        const clearTimer = () => window.clearTimeout(timeoutId);
        const attachToExistingScript = (script: HTMLScriptElement) => {
            if (isGoogleMapsCoreReady()) {
                clearTimer();
                finishReady();
                return;
            }
            const pollId = window.setInterval(() => {
                if (isGoogleMapsCoreReady()) {
                    window.clearInterval(pollId);
                    clearTimer();
                    finishReady();
                }
            }, 50);
            script.addEventListener("error", () => {
                window.clearInterval(pollId);
                clearTimer();
                settleReject("Failed to download the Google Maps JavaScript SDK.");
            }, { once: true });
        };
        const existing = (document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null) ??
            (document.getElementById(LEGACY_RADAR_SCRIPT_ID) as HTMLScriptElement | null);
        if (existing && isCompatibleGoogleMapsScript(existing)) {
            attachToExistingScript(existing);
            return;
        }
        if (existing) {
            existing.remove();
        }
        const callbackWindow = window as GoogleMapsCallbackWindow;
        callbackWindow[GOOGLE_MAPS_CALLBACK_NAME] = () => {
            delete callbackWindow[GOOGLE_MAPS_CALLBACK_NAME];
            clearTimer();
            finishReady();
        };
        const script = document.createElement("script");
        script.id = GOOGLE_MAPS_SCRIPT_ID;
        script.src = buildGoogleMapsScriptUrl(apiKey);
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            delete callbackWindow[GOOGLE_MAPS_CALLBACK_NAME];
            clearTimer();
            settleReject("Failed to download the Google Maps JavaScript SDK.");
        };
        document.head.appendChild(script);
    });
}
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Google Maps can only load in the browser."));
    }
    if (!apiKey.trim()) {
        return Promise.reject(new Error("Google Maps API key is missing from the frontend environment."));
    }
    if (isGoogleMapsCoreReady()) {
        return RESOLVED_PROMISE;
    }
    if (inflightPromise) {
        return inflightPromise;
    }
    inflightPromise = createGoogleMapsLoadPromise(apiKey);
    return inflightPromise;
}
