"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Radar } from "lucide-react";
import MapTypeToggle, { type MapViewType } from "@/components/MapTypeToggle";
import { createApiClient } from "@/lib/api-client";
import { isGoogleMapsCoreReady, loadGoogleMapsScript } from "@/lib/google-maps-loader";
import { buildStateMciMap, getStateCapacityTier, getStateFillColor, INACTIVE_MARKET_FILL_COLOR, INACTIVE_MARKET_FILL_OPACITY, INACTIVE_MARKET_HOVER_FILL_OPACITY, INACTIVE_MARKET_STROKE_COLOR, INACTIVE_MARKET_STROKE_OPACITY, INACTIVE_MARKET_STROKE_WEIGHT, isInactiveStateMetrics, STATE_HIGHLIGHT_FILL_OPACITY, STATE_HIGHLIGHT_HOVER_FILL_OPACITY, STATE_HIGHLIGHT_STROKE_COLOR, STATE_HIGHLIGHT_STROKE_WEIGHT, StateMciMetrics, US_STATES_GEOJSON_URL, } from "@/lib/radar-choropleth";
import { CAPACITY_TIER_LABELS } from "@/lib/radar-heatmap";
import { createTmsApi, RadarHeatmapZone } from "@/lib/tms-api";
interface DispatchRadarProps {
    token: string | null;
}
const DARK_RADAR_MAP_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#161616" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0B0B0B" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#A3A3A3" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#242424" }] },
    { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#0B0B0B" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1F1F1F" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#242424" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#71717A" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#050505" }] },
];
function getInactiveStateStyle(): google.maps.DataStyle {
    return {
        fillColor: INACTIVE_MARKET_FILL_COLOR,
        fillOpacity: INACTIVE_MARKET_FILL_OPACITY,
        strokeColor: INACTIVE_MARKET_STROKE_COLOR,
        strokeWeight: INACTIVE_MARKET_STROKE_WEIGHT,
        strokeOpacity: INACTIVE_MARKET_STROKE_OPACITY,
        clickable: true,
        zIndex: 0,
    };
}
function isGoogleMapsCoreAvailable(): boolean {
    if (typeof window === "undefined")
        return false;
    return Boolean(window.google?.maps);
}
function MapUnavailablePanel({ message }: {
    message: string;
}) {
    return (<div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#0B0B0B]">
      <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-[#161616] p-6 text-center">
        <p className="text-sm font-semibold text-zinc-300 mb-2">Map visualization temporarily unavailable</p>
        <p className="text-xs text-zinc-500 leading-relaxed">{message}</p>
      </div>
    </div>);
}
export default function DispatchRadar({ token }: DispatchRadarProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    const api = useMemo(() => createTmsApi(createApiClient(token)), [token]);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const dataListenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const stateMetricsRef = useRef<Map<string, StateMciMetrics>>(new Map());
    const geoJsonLoadedRef = useRef(false);
    const getStateStyleRef = useRef<(feature: google.maps.DataFeature) => google.maps.DataStyle>(() => ({
        fillOpacity: 0,
        strokeOpacity: 0,
        clickable: false,
        visible: false,
    }));
    const attachDataInteractionsRef = useRef<() => void>(() => undefined);
    const syncStateHighlightsRef = useRef<() => void>(() => undefined);
    const [mapsReady, setMapsReady] = useState(false);
    const [scriptLoading, setScriptLoading] = useState(false);
    const [mapsError, setMapsError] = useState(false);
    const [mapsErrorDetail, setMapsErrorDetail] = useState("");
    const [zones, setZones] = useState<RadarHeatmapZone[]>([]);
    const [zonesLoading, setZonesLoading] = useState(true);
    const [mapType, setMapType] = useState<MapViewType>("roadmap");
    const stateMetricsMap = useMemo(() => buildStateMciMap(zones), [zones]);
    const fetchZones = useCallback(async () => {
        if (!token) {
            setZones([]);
            setZonesLoading(false);
            return;
        }
        setZonesLoading(true);
        try {
            const res = await api.radar.heatmapSummary();
            setZones(res?.zones ?? []);
        }
        catch (error) {
            console.error("Radar zone fetch failed:", error);
            setZones([]);
        }
        finally {
            setZonesLoading(false);
        }
    }, [api, token]);
    const getStateStyle = useCallback((feature: google.maps.DataFeature): google.maps.DataStyle => {
        const stateName = feature.getProperty("name") as string;
        const metrics = stateMetricsRef.current.get(stateName);
        if (isInactiveStateMetrics(metrics)) {
            return getInactiveStateStyle();
        }
        const tier = getStateCapacityTier(metrics!.mci);
        return {
            fillColor: getStateFillColor(tier),
            fillOpacity: STATE_HIGHLIGHT_FILL_OPACITY,
            strokeColor: STATE_HIGHLIGHT_STROKE_COLOR,
            strokeWeight: STATE_HIGHLIGHT_STROKE_WEIGHT,
            strokeOpacity: 0.9,
            clickable: true,
            zIndex: 1,
        };
    }, []);
    const clearDataListeners = useCallback(() => {
        dataListenersRef.current.forEach((listener) => listener.remove());
        dataListenersRef.current = [];
    }, []);
    const attachDataInteractions = useCallback(() => {
        if (!mapRef.current)
            return;
        dataListenersRef.current.forEach((listener) => listener.remove());
        dataListenersRef.current = [];
        const dataLayer = mapRef.current.data;
        dataListenersRef.current.push(dataLayer.addListener("mouseover", (event: google.maps.DataMouseEvent) => {
            const stateName = event.feature.getProperty("name") as string;
            const metrics = stateMetricsRef.current.get(stateName);
            const inactive = isInactiveStateMetrics(metrics);
            dataLayer.overrideStyle(event.feature, {
                fillOpacity: inactive ? INACTIVE_MARKET_HOVER_FILL_OPACITY : STATE_HIGHLIGHT_HOVER_FILL_OPACITY,
            });
        }));
        dataListenersRef.current.push(dataLayer.addListener("mouseout", (event: google.maps.DataMouseEvent) => {
            dataLayer.revertStyle(event.feature);
        }));
    }, []);
    const syncStateHighlights = useCallback(() => {
        if (!mapRef.current || !geoJsonLoadedRef.current)
            return;
        mapRef.current.data.setStyle(getStateStyleRef.current);
    }, []);
    getStateStyleRef.current = getStateStyle;
    attachDataInteractionsRef.current = attachDataInteractions;
    syncStateHighlightsRef.current = syncStateHighlights;
    useEffect(() => {
        fetchZones();
    }, [fetchZones]);
    useEffect(() => {
        if (!apiKey) {
            setMapsError(true);
            setMapsErrorDetail("Google Maps API key is missing from the frontend environment.");
            setScriptLoading(false);
            setMapsReady(false);
            return;
        }
        if (isGoogleMapsCoreReady()) {
            setMapsError(false);
            setMapsErrorDetail("");
            setScriptLoading(false);
            setMapsReady(true);
            return;
        }
        let cancelled = false;
        setScriptLoading(true);
        setMapsError(false);
        setMapsErrorDetail("");
        loadGoogleMapsScript(apiKey)
            .then(() => {
            if (cancelled)
                return;
            setScriptLoading(false);
            if (!isGoogleMapsCoreReady()) {
                setMapsReady(false);
                setMapsError(true);
                setMapsErrorDetail("Google Maps did not initialize. Reload the page to retry.");
                return;
            }
            setMapsError(false);
            setMapsErrorDetail("");
            setMapsReady(true);
        })
            .catch((error: Error) => {
            if (cancelled)
                return;
            setScriptLoading(false);
            setMapsReady(false);
            setMapsError(true);
            setMapsErrorDetail(error.message || "Failed to load Google Maps.");
        });
        return () => {
            cancelled = true;
        };
    }, [apiKey]);
    useEffect(() => {
        stateMetricsRef.current = stateMetricsMap;
        syncStateHighlights();
    }, [stateMetricsMap, syncStateHighlights]);
    useEffect(() => {
        if (!mapsReady || mapsError || mapRef.current)
            return;
        if (!mapContainerRef.current || !isGoogleMapsCoreAvailable())
            return;
        try {
            mapRef.current = new google.maps.Map(mapContainerRef.current, {
                center: { lat: 39.8283, lng: -98.5795 },
                zoom: 4,
                minZoom: 3,
                maxZoom: 10,
                mapTypeId: 'roadmap',
                disableDefaultUI: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                draggable: true,
                scrollwheel: true,
                gestureHandling: "greedy",
                styles: DARK_RADAR_MAP_STYLES,
            } as google.maps.MapOptions);
            mapRef.current.data.loadGeoJson(US_STATES_GEOJSON_URL, undefined, () => {
                geoJsonLoadedRef.current = true;
                mapRef.current?.data.setStyle(getStateStyleRef.current);
                attachDataInteractionsRef.current();
                syncStateHighlightsRef.current();
            });
        }
        catch (err) {
            console.error("DispatchRadar map initialization failed:", err);
            mapRef.current = null;
            setMapsError(true);
            setMapsErrorDetail("Map initialization failed. Please refresh and try again.");
        }
        return () => {
            clearDataListeners();
            mapRef.current = null;
            geoJsonLoadedRef.current = false;
        };
    }, [clearDataListeners, mapsReady, mapsError]);
    useEffect(() => {
        if (!mapRef.current || !mapsReady || mapsError)
            return;
        const map = mapRef.current;
        if (mapType === "satellite") {
            (map as any).setMapTypeId('satellite');
            map.setOptions({ styles: [] });
        }
        else {
            (map as any).setMapTypeId('roadmap');
            map.setOptions({ styles: DARK_RADAR_MAP_STYLES });
        }
    }, [mapType, mapsReady, mapsError]);
    const hotZoneCount = zones.length;
    const highlightedStateCount = stateMetricsMap.size;
    return (<div className="min-h-screen bg-zinc-50 dark:bg-[#0B0B0B] p-8 font-sans transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Radar size={28} className="text-zinc-500"/> Market Conditions
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Historical state-level market pace across the national freight map.
            </p>
          </div>
          <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 text-sm font-semibold px-3 py-1 rounded-full">
            {hotZoneCount} Hot Zones · {highlightedStateCount} States
          </span>
        </div>

        <section className="w-full bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden transition-colors">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Market Volume Map
            </h2>
            {zonesLoading && (<span className="text-xs text-zinc-400 flex items-center gap-1">
                <Loader2 size={14} className="animate-spin"/> Syncing pool
              </span>)}
          </div>

          <div className="relative w-full h-[calc(100vh-220px)] min-h-[500px] bg-zinc-100 dark:bg-[#0B0B0B]">
            {!apiKey || mapsError ? (<MapUnavailablePanel message={mapsErrorDetail ||
                "Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to render the map."}/>) : (<>
                <div ref={mapContainerRef} className="absolute inset-0"/>
                {(scriptLoading || !mapsReady) && (<div className="absolute inset-0 flex items-center justify-center bg-[#0B0B0B]/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                      <Loader2 size={18} className="animate-spin"/>
                      Initializing map...
                    </div>
                  </div>)}
                {!zonesLoading && hotZoneCount === 0 && mapsReady && (<div className="absolute bottom-4 left-4 right-4 max-w-md px-4 py-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-400 z-10">
                    No hot zones detected yet. Operational loads will populate the radar automatically.
                  </div>)}
                {mapsReady && (<div className="absolute top-4 left-4 z-10 flex flex-col gap-3 items-start">
                    <div className="bg-[#161616]/95 border border-zinc-800 rounded-xl p-3 shadow-xl backdrop-blur-md w-48">
                      <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                        Market Pace
                      </h4>
                      <div className="flex flex-col gap-1.5 text-[11px] text-zinc-300">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/> {CAPACITY_TIER_LABELS.loose}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500"/> {CAPACITY_TIER_LABELS.balanced}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500"/> {CAPACITY_TIER_LABELS.hot}
                        </span>
                      </div>
                    </div>
                    <MapTypeToggle mapType={mapType} onToggle={() => setMapType((prev) => (prev === "roadmap" ? "satellite" : "roadmap"))} className="static shrink-0"/>
                  </div>)}
              </>)}
          </div>
        </section>
      </div>
    </div>);
}
