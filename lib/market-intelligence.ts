import type { AxiosInstance } from "axios";
import type { MarketIntelligenceResponse, RadarHeatmapZone } from "@/lib/tms-api";
export const LIVE_MARKET_FEED_URL = "https://api.dat.com/iq/v1/market-conditions";
export interface FetchMarketIntelligenceOptions {
    client: AxiosInstance;
}
export async function fetchMarketIntelligence({ client, }: FetchMarketIntelligenceOptions): Promise<MarketIntelligenceResponse> {
    const response = await client.get<MarketIntelligenceResponse>("/api/market-intelligence");
    return response.data;
}
export function extractRadarZones(payload: MarketIntelligenceResponse): RadarHeatmapZone[] {
    return payload.zones ?? [];
}
