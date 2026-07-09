import { RadarHeatmapZone } from "@/lib/tms-api";
const BASELINE_RPM = 2.31;
export const CAPACITY_HEATMAP_GRADIENT = [
    "rgba(0, 0, 0, 0)",
    "rgba(72, 165, 190, 0.35)",
    "rgba(91, 143, 185, 0.55)",
    "rgba(120, 178, 160, 0.65)",
    "rgba(245, 196, 83, 0.72)",
    "rgba(230, 126, 70, 0.82)",
    "rgba(217, 90, 60, 0.9)",
    "rgba(179, 57, 57, 0.95)",
] as const;
export const CAPACITY_LEGEND_GRADIENT = "linear-gradient(to right, #48A5BE, #5B8FB9, #78B2A0, #F5C453, #E67E46, #D95A3C, #B33939)";
export type CapacityTier = "hot" | "balanced" | "loose";
export const CAPACITY_TIER_LABELS: Record<CapacityTier, string> = {
    hot: "Fast Market",
    balanced: "Medium Market",
    loose: "Slow Market",
};
export function getCapacityTierLabel(tier: CapacityTier): string {
    return CAPACITY_TIER_LABELS[tier];
}
export interface HeatBlobPoint {
    lat: number;
    lng: number;
    weight: number;
}
export function computeZoneCapacityScore(zone: RadarHeatmapZone, nationalAvgWeight: number): number {
    const pressure = ((zone.weight / Math.max(nationalAvgWeight, 1)) - 1) * 75;
    const rpmDelta = ((zone.avgRpm / BASELINE_RPM) - 1) * 55;
    return Math.max(-100, Math.min(100, pressure + rpmDelta));
}
export function getCapacityTier(score: number): CapacityTier {
    if (score >= 12)
        return "hot";
    if (score <= -12)
        return "loose";
    return "balanced";
}
export function buildZoneMapLabel(zone: RadarHeatmapZone, tier: CapacityTier): string {
    const rpmValue = Number(zone?.avgRpm ?? 0);
    const loadCount = Number(zone?.weight ?? 0);
    const rpm = `$${rpmValue.toFixed(2)} RPM`;
    const loads = `${loadCount} Loads`;
    if (tier === "hot") {
        return `${rpm} · ${loads} · ${getCapacityTierLabel(tier)}`;
    }
    if (tier === "loose") {
        return `${rpm} · ${getCapacityTierLabel(tier)}`;
    }
    return `${rpm} · ${loads}`;
}
export function selectLabeledZones(zones: RadarHeatmapZone[] | null | undefined, maxLabels = 14): RadarHeatmapZone[] {
    const safeZones = (zones ?? []).filter((zone): zone is RadarHeatmapZone => Boolean(zone) && typeof zone.weight === "number");
    if (!safeZones.length)
        return [];
    const sorted = [...safeZones].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const topCount = Math.min(maxLabels, sorted.length);
    const thresholdWeight = sorted[Math.min(topCount - 1, sorted.length - 1)]?.weight ?? 0;
    return sorted.filter((zone) => zone.weight >= thresholdWeight).slice(0, maxLabels);
}
export function buildHeatBlobPoints(zones: RadarHeatmapZone[] | null | undefined, nationalAvgWeight: number): HeatBlobPoint[] {
    const safeZones = (zones ?? []).filter((zone): zone is RadarHeatmapZone => Boolean(zone) &&
        typeof zone.lat === "number" &&
        typeof zone.lng === "number" &&
        typeof zone.weight === "number");
    if (!safeZones.length)
        return [];
    const maxWeight = Math.max(...safeZones.map((zone) => zone.weight), 1);
    const points: HeatBlobPoint[] = [];
    safeZones.forEach((zone) => {
        const score = computeZoneCapacityScore(zone, nationalAvgWeight);
        const tier = getCapacityTier(score);
        const intensity = Math.max(0.45, zone.weight / maxWeight);
        const tierBoost = tier === "hot" ? 1.35 : tier === "loose" ? 0.75 : 1;
        const centerWeight = zone.weight * tierBoost * 1.25;
        const latSpread = 0.22 + intensity * 0.55;
        const lngSpread = 0.38 + intensity * 0.85;
        const ringSteps = 14;
        for (let i = 0; i < ringSteps; i += 1) {
            const angle = (i / ringSteps) * Math.PI * 2;
            const ring = 0.55 + (i % 3) * 0.18;
            points.push({
                lat: zone.lat + Math.sin(angle) * latSpread * ring,
                lng: zone.lng + Math.cos(angle) * lngSpread * ring,
                weight: centerWeight * (0.28 + ring * 0.22),
            });
        }
        for (let j = 0; j < 6; j += 1) {
            const innerAngle = (j / 6) * Math.PI * 2 + 0.4;
            points.push({
                lat: zone.lat + Math.sin(innerAngle) * latSpread * 0.35,
                lng: zone.lng + Math.cos(innerAngle) * lngSpread * 0.35,
                weight: centerWeight * 0.55,
            });
        }
        points.push({ lat: zone.lat, lng: zone.lng, weight: centerWeight });
    });
    return points;
}
export function getNationalAvgWeight(zones: RadarHeatmapZone[] | null | undefined): number {
    const safeZones = zones ?? [];
    if (!safeZones.length)
        return 1;
    return safeZones.reduce((sum, zone) => sum + Math.max(zone?.weight ?? 1, 1), 0) / safeZones.length;
}
