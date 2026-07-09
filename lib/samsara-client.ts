const SAMSARA_LOCATIONS_URL = 'https://api.samsara.com/fleet/vehicles/locations';
export interface SamsaraVehicleLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speedMph: number | null;
}
interface SamsaraLocationPayload {
    latitude?: number;
    longitude?: number;
    heading?: number;
    speed?: number;
    time?: string;
}
interface SamsaraVehicleRecord {
    id?: string;
    name?: string;
    location?: SamsaraLocationPayload | null;
}
interface SamsaraLocationsResponse {
    data?: SamsaraVehicleRecord[];
}
export class SamsaraApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'SamsaraApiError';
        this.status = status;
    }
}
export class SamsaraClient {
    private readonly accessToken: string;
    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }
    async fetchVehicleLocations(): Promise<SamsaraVehicleLocation[]> {
        const response = await fetch(SAMSARA_LOCATIONS_URL, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                Accept: 'application/json',
            },
            cache: 'no-store',
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new SamsaraApiError(`Samsara locations request failed (${response.status}): ${detail || response.statusText}`, response.status);
        }
        const payload = (await response.json()) as SamsaraLocationsResponse;
        const records = Array.isArray(payload.data) ? payload.data : [];
        return records
            .map((record) => this.parseVehicleRecord(record))
            .filter((record): record is SamsaraVehicleLocation => record !== null);
    }
    private parseVehicleRecord(record: SamsaraVehicleRecord): SamsaraVehicleLocation | null {
        const location = record.location;
        if (!record.id || !location)
            return null;
        const latitude = location.latitude;
        const longitude = location.longitude;
        if (typeof latitude !== 'number' || typeof longitude !== 'number')
            return null;
        return {
            id: String(record.id),
            name: String(record.name ?? record.id),
            latitude,
            longitude,
            heading: typeof location.heading === 'number' ? location.heading : null,
            speedMph: typeof location.speed === 'number' ? location.speed : null,
        };
    }
}
export async function fetchSamsaraVehicleLocations(accessToken: string): Promise<SamsaraVehicleLocation[]> {
    const client = new SamsaraClient(accessToken);
    return client.fetchVehicleLocations();
}
