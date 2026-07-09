import axios from 'axios';
export interface CompanyAvailabilityResult {
    available: boolean;
    name: string;
    detail?: string | null;
}
export async function validateCompanyAvailability(name: string, dotNumber?: string): Promise<CompanyAvailabilityResult> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await axios.get<CompanyAvailabilityResult>(`${API_URL}/api/companies/validate`, {
        params: {
            name: name.trim(),
            ...(dotNumber?.trim() ? { dot_number: dotNumber.trim() } : {}),
        },
    });
    return response.data;
}
