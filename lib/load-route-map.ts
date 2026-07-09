export const PIN_COLORS = {
    pickup: '#22c55e',
    stop: '#f59e0b',
    delivery: '#ef4444',
} as const;
export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#161616' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0B0B' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#A3A3A3' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
    { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#0B0B0B' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1F1F1F' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#71717A' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050505' }] },
];
export interface ParsedStop {
    loadId: number;
    stopIndex: number;
    kind: 'pickup' | 'stop' | 'delivery';
    label: 'P' | 'S' | 'D';
    address: string;
    companyName: string;
    dateTime: string;
    notes: string;
    color: string;
}
export interface LoadStopSource {
    id: number;
    origin: string;
    destination: string;
    detailed_stops?: Array<{
        stop_type?: string;
        date_time?: string;
        company_name?: string;
        address?: string;
        notes?: string;
    }>;
}
export function parseLoadStops(load: LoadStopSource): ParsedStop[] {
    const detailed = Array.isArray(load.detailed_stops) ? load.detailed_stops : [];
    if (detailed.length > 0) {
        return detailed.map((stop, idx) => {
            const type = (stop.stop_type || '').toLowerCase();
            let kind: ParsedStop['kind'] = 'stop';
            let label: ParsedStop['label'] = 'S';
            let color: string = PIN_COLORS.stop;
            if (type === 'pickup') {
                kind = 'pickup';
                label = 'P';
                color = PIN_COLORS.pickup;
            }
            else if (type === 'delivery') {
                kind = 'delivery';
                label = 'D';
                color = PIN_COLORS.delivery;
            }
            return {
                loadId: load.id,
                stopIndex: idx,
                kind,
                label,
                address: stop.address || load.origin || 'Address pending',
                companyName: stop.company_name || 'TBD',
                dateTime: stop.date_time || 'TBD',
                notes: stop.notes || '',
                color,
            };
        });
    }
    return [
        {
            loadId: load.id,
            stopIndex: 0,
            kind: 'pickup',
            label: 'P',
            address: load.origin || 'Origin TBD',
            companyName: 'Pickup',
            dateTime: 'TBD',
            notes: '',
            color: PIN_COLORS.pickup,
        },
        {
            loadId: load.id,
            stopIndex: 1,
            kind: 'delivery',
            label: 'D',
            address: load.destination || 'Destination TBD',
            companyName: 'Delivery',
            dateTime: 'TBD',
            notes: '',
            color: PIN_COLORS.delivery,
        },
    ];
}
export function buildPinIcon(color: string): google.maps.Symbol {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#0B0B0B',
        strokeWeight: 2,
        scale: 10,
        labelOrigin: new google.maps.Point(0, 0),
    };
}
export function geocodeAddressCached(address: string, cache: Map<string, google.maps.LatLngLiteral>, fallbackCenter: google.maps.LatLngLiteral = { lat: 39.8283, lng: -98.5795 }): Promise<google.maps.LatLngLiteral> {
    return new Promise((resolve) => {
        try {
            if (!window.google?.maps) {
                resolve(fallbackCenter);
                return;
            }
            const normalized = address.trim().toLowerCase();
            if (!normalized) {
                resolve(fallbackCenter);
                return;
            }
            const cached = cache.get(normalized);
            if (cached) {
                resolve(cached);
                return;
            }
            let geocoder: google.maps.Geocoder;
            try {
                geocoder = new google.maps.Geocoder();
            }
            catch {
                resolve(fallbackCenter);
                return;
            }
            geocoder.geocode({ address }, (results, status) => {
                try {
                    if (status === google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
                        const loc = {
                            lat: results[0].geometry.location.lat(),
                            lng: results[0].geometry.location.lng(),
                        };
                        cache.set(normalized, loc);
                        resolve(loc);
                        return;
                    }
                }
                catch {
                    resolve(fallbackCenter);
                    return;
                }
                resolve(fallbackCenter);
            });
        }
        catch {
            resolve(fallbackCenter);
        }
    });
}
export async function drawRouteBetweenStops(map: google.maps.Map, positions: google.maps.LatLngLiteral[], directionsRenderer: google.maps.DirectionsRenderer, fallbackPolylineRef: {
    current: google.maps.Polyline | null;
}): Promise<void> {
    if (positions.length < 2)
        return;
    const bounds = new google.maps.LatLngBounds();
    positions.forEach((p) => bounds.extend(p));
    if (fallbackPolylineRef.current) {
        fallbackPolylineRef.current.setMap(null);
        fallbackPolylineRef.current = null;
    }
    const origin = positions[0];
    const destination = positions[positions.length - 1];
    const waypoints = positions.length > 2
        ? positions.slice(1, -1).map((p) => ({ location: p, stopover: true }))
        : [];
    const directionsService = new google.maps.DirectionsService();
    return new Promise((resolve) => {
        directionsService.route({
            origin,
            destination,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
            if (status === 'OK' && result) {
                directionsRenderer.setDirections(result);
            }
            else {
                directionsRenderer.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
                fallbackPolylineRef.current = new google.maps.Polyline({
                    path: positions,
                    geodesic: true,
                    strokeColor: '#D4D4D4',
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    map,
                });
            }
            map.fitBounds(bounds, 32);
            resolve();
        });
    });
}
