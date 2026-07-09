export type LoadStatusFilter = 'all' | 'unassigned' | 'booked' | 'in_transit' | 'delivered' | 'delayed';
export const LOAD_TERMINAL_UI_STATUSES = ['DELIVERED', 'SETTLED'] as const;
export const LOAD_PIPELINE_UI_STATUSES = ['UNASSIGNED', 'BOOKED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED'] as const;
export type LoadTerminalUiStatus = (typeof LOAD_TERMINAL_UI_STATUSES)[number];
export const LOAD_STATUS_FILTERS: {
    id: LoadStatusFilter;
    label: string;
}[] = [
    { id: 'all', label: 'Total Loads' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'booked', label: 'Booked' },
    { id: 'in_transit', label: 'In Transit' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'delayed', label: 'Delayed' },
];
