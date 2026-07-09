declare namespace google.maps {
    class Map {
        constructor(el: HTMLElement, opts?: MapOptions);
        fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
        setCenter(latlng: LatLngLiteral | LatLng): void;
        setZoom(zoom: number): void;
        setOptions(options: MapOptions): void;
        data: Data;
    }
    class Marker {
        constructor(opts?: MarkerOptions);
        setMap(map: Map | null): void;
        setOpacity(opacity: number): void;
        setZIndex(z: number): void;
        getPosition(): LatLng | null;
        get(key: string): unknown;
        set(key: string, value: unknown): void;
        addListener(event: string, handler: () => void): void;
    }
    class InfoWindow {
        constructor(opts?: InfoWindowOptions);
        setContent(content: string | Element): void;
        setPosition(position: LatLngLiteral | LatLng): void;
        open(opts?: Map | {
            map?: Map;
            anchor?: Marker;
        }): void;
        close(): void;
    }
    class Geocoder {
        geocode(request: GeocoderRequest, callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void): void;
    }
    class DirectionsService {
        route(request: DirectionsRequest, callback: (result: DirectionsResult | null, status: DirectionsStatus) => void): void;
    }
    class DirectionsRenderer {
        constructor(opts?: DirectionsRendererOptions);
        setMap(map: Map | null): void;
        setDirections(directions: DirectionsResult): void;
    }
    class Polyline {
        constructor(opts?: PolylineOptions);
        setMap(map: Map | null): void;
    }
    class LatLng {
        constructor(lat: number, lng: number);
        lat(): number;
        lng(): number;
    }
    class LatLngBounds {
        extend(point: LatLngLiteral | LatLng): void;
        isEmpty(): boolean;
    }
    class Data {
        loadGeoJson(url: string, options?: {
            idPropertyName?: string;
        }, callback?: (features: DataFeature[]) => void): void;
        setStyle(style: DataStyle | ((feature: DataFeature) => DataStyle)): void;
        overrideStyle(feature: DataFeature, style: DataStyle): void;
        revertStyle(feature?: DataFeature): void;
        forEach(callback: (feature: DataFeature) => void): void;
        addListener(eventName: string, handler: (event: DataMouseEvent) => void): MapsEventListener;
    }
    interface DataFeature {
        getProperty(name: string): unknown;
        setProperty(name: string, value: unknown): void;
    }
    interface DataStyle {
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        clickable?: boolean;
        visible?: boolean;
        zIndex?: number;
    }
    interface DataMouseEvent {
        feature: DataFeature;
        latLng: LatLng;
    }
    class Circle {
        constructor(opts?: CircleOptions);
        setMap(map: Map | null): void;
        addListener(event: string, handler: () => void): MapsEventListener;
    }
    interface CircleOptions {
        map?: Map;
        center?: LatLngLiteral | LatLng;
        radius?: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        clickable?: boolean;
        zIndex?: number;
    }
    class Point {
        constructor(x: number, y: number);
    }
    enum SymbolPath {
        CIRCLE = 0
    }
    enum TravelMode {
        DRIVING = 'DRIVING'
    }
    enum GeocoderStatus {
        OK = 'OK'
    }
    enum DirectionsStatus {
        OK = 'OK'
    }
    interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        minZoom?: number;
        maxZoom?: number;
        styles?: MapTypeStyle[];
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        disableDefaultUI?: boolean;
        draggable?: boolean;
        scrollwheel?: boolean;
        gestureHandling?: string;
        backgroundColor?: string;
    }
    interface MapTypeStyle {
        elementType?: string;
        featureType?: string;
        stylers?: Record<string, string | number>[];
    }
    interface MarkerOptions {
        position?: LatLngLiteral;
        map?: Map;
        icon?: Symbol | string;
        label?: MarkerLabel;
        title?: string;
    }
    interface MarkerLabel {
        text: string;
        color?: string;
        fontSize?: string;
        fontWeight?: string;
    }
    interface Symbol {
        path?: SymbolPath | string;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWeight?: number;
        scale?: number;
        labelOrigin?: Point;
    }
    interface InfoWindowOptions {
        content?: string | Element;
    }
    interface GeocoderRequest {
        address?: string;
    }
    interface GeocoderResult {
        geometry: {
            location: LatLng;
        };
    }
    interface LatLngLiteral {
        lat: number;
        lng: number;
    }
    interface DirectionsRequest {
        origin: LatLngLiteral | string;
        destination: LatLngLiteral | string;
        waypoints?: DirectionsWaypoint[];
        travelMode?: TravelMode;
    }
    interface DirectionsWaypoint {
        location: LatLngLiteral;
        stopover?: boolean;
    }
    interface DirectionsResult {
        routes: unknown[];
    }
    interface DirectionsRendererOptions {
        suppressMarkers?: boolean;
        polylineOptions?: PolylineOptions;
    }
    interface PolylineOptions {
        path?: LatLngLiteral[];
        geodesic?: boolean;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        map?: Map;
    }
    interface Padding {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    }
    namespace event {
        function addListener(instance: object, eventName: string, handler: () => void): MapsEventListener;
    }
    interface MapsEventListener {
        remove(): void;
    }
    namespace visualization {
        interface WeightedLocation {
            location: LatLng;
            weight?: number;
        }
        interface HeatmapLayerOptions {
            data?: WeightedLocation[];
            map?: Map;
            radius?: number;
            opacity?: number;
            dissipating?: boolean;
        }
        class HeatmapLayer {
            constructor(opts?: HeatmapLayerOptions);
            setMap(map: Map | null): void;
        }
    }
}
interface Window {
    google?: {
        maps: typeof google.maps & {
            visualization?: typeof google.maps.visualization;
        };
    };
    gm_authFailure?: () => void;
}
