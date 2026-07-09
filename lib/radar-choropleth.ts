import { RadarHeatmapZone } from "@/lib/tms-api";
import { CapacityTier, getCapacityTier, getCapacityTierLabel } from "@/lib/radar-heatmap";
const BASELINE_RPM = 2.31;
export const US_STATES_GEOJSON_URL = "/geo/us-states.json";
export const CAPACITY_TIER_FILL_COLORS = {
    loose: "#10B981",
    balanced: "#F59E0B",
    hot: "#EF4444",
} as const;
export const STATE_HIGHLIGHT_FILL_OPACITY = 0.18;
export const STATE_HIGHLIGHT_HOVER_FILL_OPACITY = 0.28;
export const STATE_HIGHLIGHT_STROKE_COLOR = "#2A2A2A";
export const STATE_HIGHLIGHT_STROKE_WEIGHT = 1;
export const INACTIVE_MARKET_FILL_COLOR = "#27272A";
export const INACTIVE_MARKET_FILL_OPACITY = 0.25;
export const INACTIVE_MARKET_STROKE_COLOR = "#3F3F46";
export const INACTIVE_MARKET_STROKE_WEIGHT = 1;
export const INACTIVE_MARKET_STROKE_OPACITY = 0.4;
export const INACTIVE_MARKET_HOVER_FILL_OPACITY = 0.32;
export interface StateMciMetrics {
    regionName: string;
    mci: number;
    loadToTruckRatio: number;
    activeLoads: number;
    avgRpm: number;
}
const STATE_CODE_TO_NAME: Record<string, string> = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
    DC: "District of Columbia",
};
const STATE_CENTROIDS: Record<string, {
    lat: number;
    lng: number;
}> = {
    Alabama: { lat: 32.806671, lng: -86.79113 },
    Alaska: { lat: 61.370716, lng: -152.404419 },
    Arizona: { lat: 33.729759, lng: -111.431221 },
    Arkansas: { lat: 34.969704, lng: -92.373123 },
    California: { lat: 36.116203, lng: -119.681564 },
    Colorado: { lat: 39.059811, lng: -105.311104 },
    Connecticut: { lat: 41.597782, lng: -72.755371 },
    Delaware: { lat: 39.318523, lng: -75.507141 },
    Florida: { lat: 27.766279, lng: -81.686783 },
    Georgia: { lat: 33.040619, lng: -83.643074 },
    Hawaii: { lat: 21.094318, lng: -157.498337 },
    Idaho: { lat: 44.240459, lng: -114.478828 },
    Illinois: { lat: 40.349457, lng: -88.986137 },
    Indiana: { lat: 39.849426, lng: -86.258278 },
    Iowa: { lat: 42.011539, lng: -93.210526 },
    Kansas: { lat: 38.5266, lng: -96.726486 },
    Kentucky: { lat: 37.66814, lng: -84.670067 },
    Louisiana: { lat: 31.169546, lng: -91.867805 },
    Maine: { lat: 44.693947, lng: -69.381927 },
    Maryland: { lat: 39.063946, lng: -76.802101 },
    Massachusetts: { lat: 42.230171, lng: -71.530106 },
    Michigan: { lat: 43.326618, lng: -84.536095 },
    Minnesota: { lat: 45.694454, lng: -93.900192 },
    Mississippi: { lat: 32.741646, lng: -89.678696 },
    Missouri: { lat: 38.456085, lng: -92.288368 },
    Montana: { lat: 46.921925, lng: -110.454353 },
    Nebraska: { lat: 41.12537, lng: -98.268082 },
    Nevada: { lat: 38.313515, lng: -117.055374 },
    "New Hampshire": { lat: 43.452492, lng: -71.563896 },
    "New Jersey": { lat: 40.298904, lng: -74.521011 },
    "New Mexico": { lat: 34.840515, lng: -106.248482 },
    "New York": { lat: 42.165726, lng: -74.948051 },
    "North Carolina": { lat: 35.630066, lng: -79.806419 },
    "North Dakota": { lat: 47.528912, lng: -99.784012 },
    Ohio: { lat: 40.388783, lng: -82.764915 },
    Oklahoma: { lat: 35.565342, lng: -96.928917 },
    Oregon: { lat: 44.572021, lng: -122.070938 },
    Pennsylvania: { lat: 40.590752, lng: -77.209755 },
    "Rhode Island": { lat: 41.680893, lng: -71.51178 },
    "South Carolina": { lat: 33.856892, lng: -80.945007 },
    "South Dakota": { lat: 44.299782, lng: -99.438828 },
    Tennessee: { lat: 35.747845, lng: -86.692345 },
    Texas: { lat: 31.054487, lng: -97.563461 },
    Utah: { lat: 40.150032, lng: -111.862434 },
    Vermont: { lat: 44.045876, lng: -72.710686 },
    Virginia: { lat: 37.769337, lng: -78.169968 },
    Washington: { lat: 47.400902, lng: -121.490494 },
    "West Virginia": { lat: 38.491226, lng: -80.954453 },
    Wisconsin: { lat: 44.268543, lng: -89.616508 },
    Wyoming: { lat: 42.755966, lng: -107.30249 },
    "District of Columbia": { lat: 38.897438, lng: -77.026817 },
};
const REGION_TO_STATES: Record<string, string[]> = {
    "WEST COAST": ["California", "Oregon", "Washington", "Nevada"],
    "MOUNTAIN CENTRAL": ["Colorado", "Utah", "Wyoming", "Montana", "Idaho"],
    "SOUTH CENTRAL": ["Texas", "Oklahoma", "Louisiana", "Arkansas"],
    MIDWEST: ["Illinois", "Indiana", "Ohio", "Michigan", "Wisconsin", "Minnesota", "Iowa", "Missouri"],
    NORTHEAST: ["New York", "New Jersey", "Pennsylvania", "Massachusetts", "Connecticut"],
    SOUTHEAST: ["Georgia", "Florida", "North Carolina", "South Carolina", "Alabama", "Tennessee"],
};
export function getStateCapacityTier(mci: number): CapacityTier {
    return getCapacityTier(mci);
}
export function getStateFillColor(tier: CapacityTier): string {
    return CAPACITY_TIER_FILL_COLORS[tier];
}
export function isInactiveStateMetrics(metrics: StateMciMetrics | undefined | null): boolean {
    if (!metrics)
        return true;
    return metrics.activeLoads === 0;
}
export function buildInactiveFallbackMetrics(stateName: string): StateMciMetrics {
    return {
        regionName: stateName,
        mci: 0,
        loadToTruckRatio: 0,
        activeLoads: 0,
        avgRpm: 0,
    };
}
function interpolateHexColor(from: string, to: string, ratio: number): string {
    const clamped = Math.max(0, Math.min(1, ratio));
    const parse = (hex: string) => {
        const normalized = hex.replace("#", "");
        return [
            parseInt(normalized.slice(0, 2), 16),
            parseInt(normalized.slice(2, 4), 16),
            parseInt(normalized.slice(4, 6), 16),
        ];
    };
    const [r1, g1, b1] = parse(from);
    const [r2, g2, b2] = parse(to);
    const r = Math.round(r1 + (r2 - r1) * clamped);
    const g = Math.round(g1 + (g2 - g1) * clamped);
    const b = Math.round(b1 + (b2 - b1) * clamped);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
export function getMciColor(score: number): string {
    const s = Math.max(-100, Math.min(100, score));
    if (s <= -10) {
        const t = (s + 100) / 90;
        return interpolateHexColor("#2E5B88", "#4A7BB0", t);
    }
    if (s < 0) {
        const t = (s + 10) / 10;
        return interpolateHexColor("#4A7BB0", "#E2F0D9", t);
    }
    if (s <= 10) {
        const t = s / 10;
        return interpolateHexColor("#E2F0D9", "#F2E7D5", t);
    }
    const t = (s - 10) / 90;
    return interpolateHexColor("#D96B43", "#B33939", t);
}
function nearestStateByCoords(lat: number, lng: number): string {
    let best = "Kansas";
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [name, centroid] of Object.entries(STATE_CENTROIDS)) {
        const dLat = lat - centroid.lat;
        const dLng = lng - centroid.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < bestDist) {
            bestDist = dist;
            best = name;
        }
    }
    return best;
}
function resolveStatesFromZone(zone: RadarHeatmapZone): string[] {
    const label = (zone.cityName || "").trim().toUpperCase();
    const codeMatch = label.match(/,\s*([A-Z]{2})$/);
    if (codeMatch) {
        const stateName = STATE_CODE_TO_NAME[codeMatch[1]];
        return stateName ? [stateName] : [];
    }
    if (REGION_TO_STATES[label]) {
        return REGION_TO_STATES[label];
    }
    for (const [region, states] of Object.entries(REGION_TO_STATES)) {
        if (label.includes(region)) {
            return states;
        }
    }
    for (const stateName of Object.keys(STATE_CENTROIDS)) {
        if (label.includes(stateName.toUpperCase())) {
            return [stateName];
        }
    }
    return [nearestStateByCoords(zone.lat, zone.lng)];
}
function computeZoneMci(zone: RadarHeatmapZone, nationalAvgWeight: number): number {
    if (typeof zone.mci === "number" && Number.isFinite(zone.mci)) {
        return Math.max(-100, Math.min(100, Math.round(zone.mci)));
    }
    const pressure = ((zone.weight / Math.max(nationalAvgWeight, 1)) - 1) * 75;
    const rpmDelta = ((zone.avgRpm / BASELINE_RPM) - 1) * 55;
    return Math.max(-100, Math.min(100, pressure + rpmDelta));
}
function deriveLoadToTruckRatio(zone: RadarHeatmapZone): number {
    return Math.max(0.4, Number((zone.weight / 12).toFixed(2)));
}
export function buildStateMciMap(zones: RadarHeatmapZone[]): Map<string, StateMciMetrics> {
    const accum = new Map<string, {
        mciSum: number;
        weightSum: number;
        ratioSum: number;
        loads: number;
        rpmSum: number;
        count: number;
    }>();
    if (!zones.length) {
        return new Map();
    }
    const nationalAvgWeight = zones.reduce((sum, zone) => sum + Math.max(zone.weight, 1), 0) / zones.length;
    zones.forEach((zone) => {
        const zoneMci = computeZoneMci(zone, nationalAvgWeight);
        const ratio = deriveLoadToTruckRatio(zone);
        const targetStates = resolveStatesFromZone(zone);
        const share = 1 / Math.max(targetStates.length, 1);
        targetStates.forEach((stateName) => {
            const bucket = accum.get(stateName) || {
                mciSum: 0,
                weightSum: 0,
                ratioSum: 0,
                loads: 0,
                rpmSum: 0,
                count: 0,
            };
            bucket.mciSum += zoneMci * share;
            bucket.weightSum += zone.weight * share;
            bucket.ratioSum += ratio * share;
            bucket.loads += Math.round(zone.weight * share);
            bucket.rpmSum += zone.avgRpm * share;
            bucket.count += share;
            accum.set(stateName, bucket);
        });
    });
    const result = new Map<string, StateMciMetrics>();
    accum.forEach((bucket, regionName) => {
        const divisor = Math.max(bucket.count, 1);
        result.set(regionName, {
            regionName,
            mci: Math.round(bucket.mciSum / divisor),
            loadToTruckRatio: Number((bucket.ratioSum / divisor).toFixed(2)),
            activeLoads: bucket.loads,
            avgRpm: Number((bucket.rpmSum / divisor).toFixed(2)),
        });
    });
    return result;
}
export function buildChoroplethInfoHtml(metrics: StateMciMetrics): string {
    if (isInactiveStateMetrics(metrics)) {
        return `
    <div style="font-family:system-ui,sans-serif;min-width:230px;padding:4px 2px;color:#ffffff;background:#161616;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">${metrics.regionName}</p>
      <div style="display:grid;gap:8px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Market</span>
          <span style="font-weight:700;color:#71717a;">No Active Loads</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Active Loads</span>
          <span style="font-weight:700;color:#ffffff;">0</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:8px;border-top:1px solid #3f3f46;">
          <span style="color:#a1a1aa;">Avg RPM</span>
          <span style="font-weight:700;color:#a1a1aa;">$0.00 / MI</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Capacity Score</span>
          <span style="font-weight:600;color:#71717a;">--</span>
        </div>
      </div>
    </div>
  `;
    }
    const tier = getStateCapacityTier(metrics.mci);
    const accent = getStateFillColor(tier);
    const tierLabel = getCapacityTierLabel(tier);
    return `
    <div style="font-family:system-ui,sans-serif;min-width:230px;padding:4px 2px;color:#ffffff;background:#161616;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">${metrics.regionName}</p>
      <div style="display:grid;gap:8px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Market</span>
          <span style="font-weight:700;color:${accent};">${tierLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Active Loads</span>
          <span style="font-weight:700;color:#ffffff;">${metrics.activeLoads}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:8px;border-top:1px solid #3f3f46;">
          <span style="color:#a1a1aa;">Avg RPM</span>
          <span style="font-weight:800;color:#34d399;">$${metrics.avgRpm.toFixed(2)} / MI</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Capacity Score</span>
          <span style="font-weight:600;color:#ffffff;">${metrics.mci > 0 ? "+" : ""}${metrics.mci}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:#a1a1aa;">Load-to-Truck Ratio</span>
          <span style="font-weight:600;color:#ffffff;">${metrics.loadToTruckRatio.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}
export const MCI_LEGEND_STOPS = [
    { label: "Tight (+100)", color: "#B33939" },
    { label: "Hot (+50)", color: "#D96B43" },
    { label: "Balanced (0)", color: "#E2F0D9" },
    { label: "Loose (-50)", color: "#4A7BB0" },
    { label: "Cool (-100)", color: "#2E5B88" },
] as const;
