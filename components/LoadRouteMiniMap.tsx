"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { isGoogleMapsCoreReady, isGoogleMapsEnvironmentReady, loadGoogleMapsScript, } from "@/lib/google-maps-loader";
import { buildPinIcon, DARK_MAP_STYLES, drawRouteBetweenStops, geocodeAddressCached, parseLoadStops, } from "@/lib/load-route-map";
import { LoadRecord } from "@/lib/tms-api";
interface LoadRouteMiniMapProps {
    load: LoadRecord;
    className?: string;
}
export default function LoadRouteMiniMap({ load, className }: LoadRouteMiniMapProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const fallbackPolylineRef = useRef<google.maps.Polyline | null>(null);
    const geocodeCacheRef = useRef<Map<string, google.maps.LatLngLiteral>>(new Map());
    const [mapsReady, setMapsReady] = useState(false);
    const [scriptLoading, setScriptLoading] = useState(false);
    const [plotting, setPlotting] = useState(false);
    const [mapsError, setMapsError] = useState(false);
    const stops = useMemo(() => parseLoadStops(load), [load]);
    const clearOverlays = useCallback(() => {
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        directionsRendererRef.current?.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
        if (fallbackPolylineRef.current) {
            fallbackPolylineRef.current.setMap(null);
            fallbackPolylineRef.current = null;
        }
    }, []);
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
            fullscreenControl: false,
            zoomControl: false,
            disableDefaultUI: true,
            backgroundColor: '#0B0B0B',
            gestureHandling: 'cooperative',
        } as google.maps.MapOptions);
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#D4D4D4',
                strokeOpacity: 0.85,
                strokeWeight: 3,
            },
        });
        directionsRendererRef.current.setMap(mapRef.current);
    }, [mapsReady, mapsError]);
    useEffect(() => {
        if (!mapsReady || mapsError || !mapRef.current)
            return;
        let cancelled = false;
        const plotRoute = async () => {
            setPlotting(true);
            clearOverlays();
            const map = mapRef.current!;
            const routeStops = stops.filter((stop) => stop.kind === 'pickup' || stop.kind === 'delivery');
            const targets = routeStops.length >= 2 ? routeStops : stops.slice(0, 2);
            const positions: google.maps.LatLngLiteral[] = [];
            const plottedStops: typeof targets = [];
            for (const stop of targets) {
                const position = await geocodeAddressCached(stop.address, geocodeCacheRef.current);
                if (cancelled)
                    return;
                if (!position)
                    continue;
                positions.push(position);
                plottedStops.push(stop);
            }
            if (positions.length === 0) {
                setPlotting(false);
                return;
            }
            const newMarkers: google.maps.Marker[] = [];
            plottedStops.forEach((stop, idx) => {
                const position = positions[idx];
                if (!position)
                    return;
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
                    title: `${stop.companyName} — ${stop.address}`,
                });
                newMarkers.push(marker);
            });
            markersRef.current = newMarkers;
            if (positions.length >= 2 && directionsRendererRef.current) {
                await drawRouteBetweenStops(map, positions, directionsRendererRef.current, fallbackPolylineRef);
            }
            else if (positions.length === 1) {
                map.setCenter(positions[0]);
                map.setZoom(8);
            }
            if (!cancelled)
                setPlotting(false);
        };
        void plotRoute();
        return () => {
            cancelled = true;
        };
    }, [mapsReady, mapsError, stops, load.id, clearOverlays]);
    useEffect(() => {
        return () => {
            clearOverlays();
            mapRef.current = null;
        };
    }, [clearOverlays]);
    const showLoadingOverlay = !mapsError && (scriptLoading || !mapsReady || plotting);
    return (<div className={`relative w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900 ${className ?? 'h-48 mb-4'}`}>
      <div ref={mapContainerRef} className="absolute inset-0" aria-hidden={mapsError}/>

      {showLoadingOverlay && (<div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/85 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 size={18} className="animate-spin"/>
            <span className="text-xs font-medium">
              {scriptLoading || !mapsReady ? 'Loading map...' : 'Plotting route...'}
            </span>
          </div>
        </div>)}

      {mapsError && (<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900 px-4 text-center">
          <span className="text-[11px] text-zinc-500">Map preview unavailable</span>
        </div>)}
    </div>);
}
