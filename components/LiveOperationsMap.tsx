"use client";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { MapViewType } from '@/components/MapTypeToggle';
import { isGoogleMapsCoreReady, isGoogleMapsEnvironmentReady, loadGoogleMapsScript, } from '@/lib/google-maps-loader';
import { buildPinIcon, DARK_MAP_STYLES, geocodeAddressCached, parseLoadStops, type ParsedStop, } from '@/lib/load-route-map';
import type { LoadRecord, TelemetryMapMarker, TelemetryMapTrail } from '@/lib/tms-api';
import { isValidTelemetryCoordinate } from '@/lib/live-operations-utils';
export interface IdleAssetMapMarker {
    id: number;
    latitude: number;
    longitude: number;
    label: string;
}
export interface LiveOperationsMapHandle {
    fitLoadViewport: (loadId: number | null) => void;
    fitCoordinates: (points: Array<{
        lat: number;
        lng: number;
    }>) => void;
}
interface LiveOperationsMapProps {
    loads: LoadRecord[];
    selectedLoadId: number | null;
    hoveredLoadId: number | null;
    mapType: MapViewType;
    telemetryMarkers?: TelemetryMapMarker[];
    telemetryTrails?: TelemetryMapTrail[];
    idleAssetMarkers?: IdleAssetMapMarker[];
    showAllTelemetryMarkers?: boolean;
    telemetryOnlyViewport?: boolean;
}
interface StoredStop {
    load: LoadRecord;
    stop: ParsedStop;
    position: google.maps.LatLngLiteral;
}
function buildRouteCacheKey(load: LoadRecord): string {
    const timestamp = load.updated_at || load.created_at || 'unknown';
    return `fleety_route_${load.id}_${timestamp}`;
}
function readCachedRoutePath(cacheKey: string): google.maps.LatLngLiteral[] | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || parsed.length < 2)
            return null;
        const coords = parsed.filter((point): point is google.maps.LatLngLiteral => {
            if (typeof point !== 'object' || point == null)
                return false;
            const candidate = point as google.maps.LatLngLiteral;
            return typeof candidate.lat === 'number' && typeof candidate.lng === 'number';
        });
        return coords.length >= 2 ? coords : null;
    }
    catch {
        return null;
    }
}
function writeCachedRoutePath(cacheKey: string, path: google.maps.LatLngLiteral[]): void {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(cacheKey, JSON.stringify(path));
    }
    catch {
    }
}
function extractOverviewPath(result: google.maps.DirectionsResult): google.maps.LatLngLiteral[] {
    const route = result.routes?.[0] as any;
    const overviewPath = route?.overview_path;
    if (!overviewPath?.length)
        return [];
    return overviewPath.map((latLng: any) => ({
        lat: typeof latLng.lat === 'function' ? latLng.lat() : Number(latLng.lat),
        lng: typeof latLng.lng === 'function' ? latLng.lng() : Number(latLng.lng),
    }));
}
function renderCachedRoutePolyline(map: google.maps.Map, path: google.maps.LatLngLiteral[], isSelected: boolean, fallbackPolylineRef: React.MutableRefObject<google.maps.Polyline | null>) {
    if (fallbackPolylineRef.current) {
        fallbackPolylineRef.current.setMap(null);
        fallbackPolylineRef.current = null;
    }
    fallbackPolylineRef.current = new google.maps.Polyline({
        path,
        geodesic: false,
        strokeColor: '#A78BFA',
        strokeOpacity: isSelected ? 0.95 : 0.75,
        strokeWeight: isSelected ? 4 : 3,
        map,
    });
}
function MapInitializationBanner({ title, detail, apiKeyConfigured, }: {
    title: string;
    detail: string;
    apiKeyConfigured: boolean;
}) {
    return (<div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-100 p-6 dark:bg-[#0B0B0B]">
      <div className="max-w-lg w-full rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-lg dark:border-zinc-800 dark:bg-[#161616]">
        <AlertTriangle className="mx-auto text-amber-500 dark:text-amber-400 mb-3" size={36}/>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{detail}</p>
        <ul className="text-left text-xs text-zinc-500 space-y-1.5">
          {!apiKeyConfigured && (<li>
              Set <code className="text-zinc-700 dark:text-zinc-300">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{' '}
              <code className="text-zinc-500 dark:text-zinc-400">frontend/.env.local</code>
            </li>)}
          <li>Enable Maps JavaScript API, Geocoding API, and Directions API in Google Cloud Console</li>
          <li>Restart the Next.js dev server after updating environment variables</li>
        </ul>
      </div>
    </div>);
}
const LiveOperationsMap = forwardRef<LiveOperationsMapHandle, LiveOperationsMapProps>(function LiveOperationsMap({ loads, selectedLoadId, hoveredLoadId, mapType, telemetryMarkers = [], telemetryTrails = [], idleAssetMarkers = [], showAllTelemetryMarkers = false, telemetryOnlyViewport = false, }, ref) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const fallbackPolylineRef = useRef<google.maps.Polyline | null>(null);
    const telemetryPolylineRef = useRef<google.maps.Polyline | null>(null);
    const truckMarkersRef = useRef<google.maps.Marker[]>([]);
    const directionsRequestIdRef = useRef(0);
    const routePathsRef = useRef<Map<number, google.maps.LatLngLiteral[]>>(new Map());
    const loadStopsRef = useRef<Map<number, StoredStop[]>>(new Map());
    const geocodeCacheRef = useRef<Map<string, google.maps.LatLngLiteral>>(new Map());
    const [mapsReady, setMapsReady] = useState(false);
    const [scriptLoading, setScriptLoading] = useState(false);
    const [mapsError, setMapsError] = useState(false);
    const [plotting, setPlotting] = useState(false);
    const shouldRecenterViewportRef = useRef(true);
    const lastPlottedSignatureRef = useRef('');
    const lastViewportLoadIdRef = useRef<number | null>(null);
    const operationalLoads = useMemo(() => loads.filter((load) => load.truck_id), [loads]);
    const operationalLoadSignature = useMemo(() => operationalLoads
        .map((load) => `${load.id}:${load.updated_at ?? load.created_at ?? ''}:${load.status ?? ''}:${load.origin ?? ''}:${load.destination ?? ''}`)
        .sort()
        .join('|'), [operationalLoads]);
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        truckMarkersRef.current.forEach((marker) => marker.setMap(null));
        truckMarkersRef.current = [];
    }, []);
    const clearTelemetryOverlay = useCallback(() => {
        if (telemetryPolylineRef.current) {
            telemetryPolylineRef.current.setMap(null);
            telemetryPolylineRef.current = null;
        }
    }, []);
    const clearFocusedRoute = useCallback(() => {
        directionsRequestIdRef.current += 1;
        directionsRendererRef.current?.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
        if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
            fallbackPolylineRef.current = null;
        }
    }, []);
    const clearOverlays = useCallback(() => {
        clearMarkers();
        clearFocusedRoute();
        clearTelemetryOverlay();
        loadStopsRef.current.clear();
        routePathsRef.current.clear();
    }, [clearMarkers, clearFocusedRoute, clearTelemetryOverlay]);
    const syncFocusedPolylines = useCallback(() => {
        const map = mapRef.current;
        const directionsRenderer = directionsRendererRef.current;
        const directionsService = directionsServiceRef.current;
        if (!map || !directionsRenderer || !directionsService)
            return;
        const focusedLoadId = selectedLoadId ?? hoveredLoadId ?? null;
        if (focusedLoadId == null) {
            clearFocusedRoute();
            return;
        }
        const focusedLoad = operationalLoads.find((load) => load.id === focusedLoadId);
        const routePositions = routePathsRef.current.get(focusedLoadId);
        if (!focusedLoad || !routePositions || routePositions.length < 2) {
            clearFocusedRoute();
            return;
        }
        const requestId = directionsRequestIdRef.current + 1;
        directionsRequestIdRef.current = requestId;
        if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
            fallbackPolylineRef.current = null;
        }
        const cacheKey = buildRouteCacheKey(focusedLoad);
        const cachedPath = readCachedRoutePath(cacheKey);
        if (cachedPath) {
            directionsRenderer.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
            renderCachedRoutePolyline(map, cachedPath, focusedLoadId === selectedLoadId, fallbackPolylineRef);
            return;
        }
        const origin = routePositions[0];
        const destination = routePositions[routePositions.length - 1];
        const waypoints = routePositions.length > 2
            ? routePositions.slice(1, -1).map((position) => ({ location: position, stopover: true }))
            : [];
        directionsService.route({
            origin,
            destination,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
            if (requestId !== directionsRequestIdRef.current)
                return;
            if (focusedLoadId !== (selectedLoadId ?? hoveredLoadId ?? null))
                return;
            if (status === google.maps.DirectionsStatus.OK && result) {
                directionsRenderer.setDirections(result);
                const overviewPath = extractOverviewPath(result);
                if (overviewPath.length >= 2) {
                    writeCachedRoutePath(cacheKey, overviewPath);
                }
                return;
            }
            directionsRenderer.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
            renderCachedRoutePolyline(map, routePositions, focusedLoadId === selectedLoadId, fallbackPolylineRef);
        });
    }, [operationalLoads, selectedLoadId, hoveredLoadId, clearFocusedRoute]);
    const syncFocusedMarkers = useCallback(() => {
        const map = mapRef.current;
        if (!map)
            return;
        clearMarkers();
        const focusIds = new Set<number>();
        if (selectedLoadId != null)
            focusIds.add(selectedLoadId);
        if (hoveredLoadId != null)
            focusIds.add(hoveredLoadId);
        const newMarkers: google.maps.Marker[] = [];
        focusIds.forEach((loadId) => {
            const storedStops = loadStopsRef.current.get(loadId) ?? [];
            const isSelected = loadId === selectedLoadId;
            for (const { load, stop, position } of storedStops) {
                if (stop.kind !== 'pickup' && stop.kind !== 'delivery')
                    continue;
                const marker = new google.maps.Marker({
                    position,
                    map,
                    icon: buildPinIcon(stop.color),
                    label: {
                        text: stop.label,
                        color: '#0B0B0B',
                        fontSize: '9px',
                        fontWeight: 'bold',
                    },
                    title: `${formatLoadLabel(load)} — ${stop.companyName}`,
                    zIndex: isSelected ? 200 : 150,
                } as google.maps.MarkerOptions);
                marker.set('loadId', load.id);
                newMarkers.push(marker);
            }
        });
        markersRef.current = newMarkers;
    }, [clearMarkers, selectedLoadId, hoveredLoadId]);
    const syncTelemetryOverlay = useCallback(() => {
        const map = mapRef.current;
        if (!map)
            return;
        clearTelemetryOverlay();
        truckMarkersRef.current.forEach((marker) => marker.setMap(null));
        truckMarkersRef.current = [];
        const focusedLoadId = selectedLoadId ?? hoveredLoadId ?? null;
        const safeMarkers = (telemetryMarkers ?? []).filter((marker) => marker.latitude != null &&
            marker.longitude != null &&
            !Number.isNaN(marker.latitude) &&
            !Number.isNaN(marker.longitude));
        for (const marker of safeMarkers) {
            if (!showAllTelemetryMarkers && focusedLoadId != null && marker.loadId !== focusedLoadId) {
                continue;
            }
            const truckMarker = new google.maps.Marker({
                position: { lat: marker.latitude as number, lng: marker.longitude as number },
                map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: '#10B981',
                    fillOpacity: 0.95,
                    strokeColor: '#064E3B',
                    strokeWeight: 1,
                },
                title: `Live truck position — Load ${marker.loadId}`,
                zIndex: 250,
            } as google.maps.MarkerOptions);
            truckMarkersRef.current.push(truckMarker);
        }
        for (const asset of idleAssetMarkers) {
            const assetMarker = new google.maps.Marker({
                position: { lat: asset.latitude, lng: asset.longitude },
                map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#F59E0B',
                    fillOpacity: 0.95,
                    strokeColor: '#92400E',
                    strokeWeight: 1,
                },
                title: asset.label,
                zIndex: 240,
            } as google.maps.MarkerOptions);
            truckMarkersRef.current.push(assetMarker);
        }
        const trailCandidates = (telemetryTrails ?? []).filter((trail) => trail.points.length >= 2);
        const activeTrail = focusedLoadId != null
            ? trailCandidates.find((trail) => trail.loadId === focusedLoadId) ?? null
            : trailCandidates[0] ?? null;
        if (!activeTrail)
            return;
        telemetryPolylineRef.current = new google.maps.Polyline({
            path: activeTrail.points.map((point) => ({ lat: point.lat, lng: point.lng })),
            geodesic: true,
            strokeColor: '#34D399',
            strokeOpacity: 0.85,
            strokeWeight: 3,
            map,
        });
    }, [
        clearTelemetryOverlay,
        hoveredLoadId,
        idleAssetMarkers,
        selectedLoadId,
        showAllTelemetryMarkers,
        telemetryMarkers,
        telemetryTrails,
    ]);
    const fitMapViewport = useCallback((loadId: number | null, extraPoints?: Array<{
        lat: number;
        lng: number;
    }>) => {
        const map = mapRef.current;
        if (!map)
            return;
        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;
        const extendFromStops = (stops: StoredStop[]) => {
            stops.forEach(({ position }) => {
                if (!isValidTelemetryCoordinate(position.lat, position.lng))
                    return;
                bounds.extend(position);
                hasBounds = true;
            });
        };
        if (loadId != null) {
            if (!telemetryOnlyViewport) {
                const focusedStops = loadStopsRef.current.get(loadId);
                if (focusedStops?.length) {
                    extendFromStops(focusedStops);
                }
            }
            if (!hasBounds) {
                const telemetryMatch = telemetryMarkers.find((marker) => marker.loadId === loadId);
                if (telemetryMatch &&
                    telemetryMatch.latitude !== null &&
                    telemetryMatch.longitude !== null &&
                    isValidTelemetryCoordinate(telemetryMatch.latitude, telemetryMatch.longitude)) {
                    bounds.extend({ lat: telemetryMatch.latitude, lng: telemetryMatch.longitude });
                    hasBounds = true;
                }
            }
        }
        else if (!telemetryOnlyViewport) {
            loadStopsRef.current.forEach((stops) => extendFromStops(stops));
        }
        extraPoints?.forEach((point) => {
            if (!isValidTelemetryCoordinate(point.lat, point.lng))
                return;
            bounds.extend(point);
            hasBounds = true;
        });
        if (!hasBounds && idleAssetMarkers.length > 0) {
            idleAssetMarkers.forEach((asset) => {
                if (!isValidTelemetryCoordinate(asset.latitude, asset.longitude))
                    return;
                bounds.extend({ lat: asset.latitude, lng: asset.longitude });
                hasBounds = true;
            });
        }
        if (hasBounds)
            map.fitBounds(bounds, 48);
    }, [idleAssetMarkers, telemetryMarkers, telemetryOnlyViewport]);
    useImperativeHandle(ref, () => ({
        fitLoadViewport: (loadId: number | null) => {
            shouldRecenterViewportRef.current = true;
            lastViewportLoadIdRef.current = loadId;
            fitMapViewport(loadId);
        },
        fitCoordinates: (points: Array<{
            lat: number;
            lng: number;
        }>) => {
            const map = mapRef.current;
            if (!map || points.length === 0)
                return;
            const valid = points.filter((point) => isValidTelemetryCoordinate(point.lat, point.lng));
            if (valid.length === 0)
                return;
            shouldRecenterViewportRef.current = true;
            if (valid.length === 1) {
                map.setCenter(valid[0]);
                map.setZoom(10);
                return;
            }
            const bounds = new google.maps.LatLngBounds();
            valid.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds, 48);
        },
    }), [fitMapViewport]);
    useEffect(() => {
        if (!apiKey) {
            setMapsError(true);
            setScriptLoading(false);
            return;
        }
        if (isGoogleMapsCoreReady()) {
            setMapsReady(true);
            setScriptLoading(false);
            return;
        }
        let cancelled = false;
        setScriptLoading(true);
        loadGoogleMapsScript(apiKey)
            .then(() => {
            if (cancelled)
                return;
            setScriptLoading(false);
            setMapsReady(isGoogleMapsEnvironmentReady());
        })
            .catch(() => {
            if (cancelled)
                return;
            setMapsError(true);
            setScriptLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [apiKey]);
    useEffect(() => {
        if (!mapsReady || mapsError || mapRef.current)
            return;
        if (!mapContainerRef.current || !isGoogleMapsEnvironmentReady())
            return;
        mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center: { lat: 39.8283, lng: -98.5795 },
            zoom: 4,
            mapTypeId: 'roadmap',
            styles: DARK_MAP_STYLES,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            backgroundColor: '#0B0B0B',
            gestureHandling: 'greedy',
        } as google.maps.MapOptions);
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#A78BFA',
                strokeOpacity: 0.95,
                strokeWeight: 4,
            },
        });
        directionsRendererRef.current.setMap(mapRef.current);
    }, [mapsReady, mapsError]);
    useEffect(() => {
        if (!mapRef.current)
            return;
        (mapRef.current as google.maps.Map & {
            setMapTypeId: (typeId: string) => void;
        }).setMapTypeId(mapType === 'satellite' ? 'hybrid' : 'roadmap');
    }, [mapType, mapsReady]);
    useEffect(() => {
        if (!mapsReady || mapsError || !mapRef.current)
            return;
        const signatureChanged = lastPlottedSignatureRef.current !== operationalLoadSignature;
        if (!signatureChanged) {
            syncFocusedMarkers();
            syncFocusedPolylines();
            syncTelemetryOverlay();
            return;
        }
        let cancelled = false;
        const plotFleet = async () => {
            setPlotting(true);
            clearOverlays();
            const map = mapRef.current!;
            const bounds = new google.maps.LatLngBounds();
            let hasBounds = false;
            for (const load of operationalLoads) {
                const stops = parseLoadStops(load);
                const routeStops = stops.filter((stop) => stop.kind === 'pickup' || stop.kind === 'delivery');
                const targets = routeStops.length >= 2 ? routeStops : stops.slice(0, 2);
                const storedStops: StoredStop[] = [];
                const routePositions: google.maps.LatLngLiteral[] = [];
                for (const stop of stops) {
                    let position: google.maps.LatLngLiteral;
                    try {
                        position = await geocodeAddressCached(stop.address, geocodeCacheRef.current);
                    }
                    catch {
                        position = { lat: 39.8283, lng: -98.5795 };
                    }
                    if (cancelled)
                        return;
                    storedStops.push({ load, stop, position });
                    if (targets.some((target) => target.stopIndex === stop.stopIndex)) {
                        routePositions.push(position);
                    }
                    bounds.extend(position);
                    hasBounds = true;
                }
                loadStopsRef.current.set(load.id, storedStops);
                if (routePositions.length >= 2) {
                    routePathsRef.current.set(load.id, routePositions);
                }
            }
            if (!cancelled) {
                lastPlottedSignatureRef.current = operationalLoadSignature;
                syncFocusedMarkers();
                syncFocusedPolylines();
                syncTelemetryOverlay();
                if (hasBounds && shouldRecenterViewportRef.current) {
                    fitMapViewport(selectedLoadId);
                    shouldRecenterViewportRef.current = false;
                }
                setPlotting(false);
            }
        };
        void plotFleet();
        return () => {
            cancelled = true;
        };
    }, [
        mapsReady,
        mapsError,
        operationalLoadSignature,
        operationalLoads,
        clearOverlays,
        syncFocusedMarkers,
        syncFocusedPolylines,
        syncTelemetryOverlay,
        fitMapViewport,
        selectedLoadId,
    ]);
    useEffect(() => {
        if (!mapsReady || mapsError)
            return;
        syncFocusedMarkers();
        syncFocusedPolylines();
        syncTelemetryOverlay();
    }, [
        hoveredLoadId,
        mapsReady,
        mapsError,
        syncFocusedMarkers,
        syncFocusedPolylines,
        syncTelemetryOverlay,
        telemetryMarkers,
        telemetryTrails,
        idleAssetMarkers,
        showAllTelemetryMarkers,
    ]);
    useEffect(() => {
        if (!mapsReady || mapsError)
            return;
        if (lastViewportLoadIdRef.current === selectedLoadId && !shouldRecenterViewportRef.current) {
            return;
        }
        lastViewportLoadIdRef.current = selectedLoadId;
        shouldRecenterViewportRef.current = true;
        fitMapViewport(selectedLoadId);
        shouldRecenterViewportRef.current = false;
    }, [selectedLoadId, mapsReady, mapsError, fitMapViewport]);
    useEffect(() => {
        return () => {
            clearOverlays();
            directionsRendererRef.current?.setMap(null);
            directionsRendererRef.current = null;
            directionsServiceRef.current = null;
            mapRef.current = null;
        };
    }, [clearOverlays]);
    const showLoadingOverlay = !mapsError && (scriptLoading || !mapsReady || plotting);
    return (<div className="relative min-h-[540px] flex-1">
      <div ref={mapContainerRef} className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" aria-hidden={mapsError}/>

      {showLoadingOverlay && (<div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100/85 backdrop-blur-[1px] dark:bg-zinc-900/85">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Loader2 size={18} className="animate-spin"/>
            <span className="text-xs font-medium">
              {scriptLoading || !mapsReady ? 'Loading fleet map...' : 'Plotting active routes...'}
            </span>
          </div>
        </div>)}

      {mapsError && (<MapInitializationBanner title="Fleet map unavailable" detail="Google Maps could not be initialized for Live Operations." apiKeyConfigured={Boolean(apiKey)}/>)}
    </div>);
});
export default LiveOperationsMap;
function formatLoadLabel(load: LoadRecord) {
    const brokerId = load.broker_load_id?.trim();
    return brokerId ? `#${brokerId.replace(/^#/, '')}` : `#${load.id}`;
}
