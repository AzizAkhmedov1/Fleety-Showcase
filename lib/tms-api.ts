import { AxiosInstance } from 'axios';
export interface LoadRecord {
    id: number;
    broker_load_id?: string | null;
    truck_id?: number | null;
    driver_id?: number | null;
    driver_name?: string | null;
    dispatcher_id?: number | null;
    origin: string;
    destination: string;
    status: string;
    payment_status?: string;
    linehaul_rate?: number;
    total_miles?: number;
    miles_traveled?: number;
    net_profit?: number;
    fuel_cost?: number;
    toll_cost?: number;
    driver_pay?: number;
    customer_id?: number | null;
    broker_name?: string | null;
    broker_email?: string | null;
    broker_phone?: string | null;
    broker_address?: string | null;
    source_channel?: string | null;
    ingest_sender_email?: string | null;
    ingest_email_subject?: string | null;
    ingest_has_pdf?: number;
    created_at?: string;
    updated_at?: string | null;
    pickup_date?: string | null;
    delivery_date?: string | null;
    trailer_number?: string | null;
    truck_number?: string | null;
    trailer_id?: number | null;
    pickup_number?: string | null;
    comments?: string | null;
    is_flagged?: boolean;
    load_notes?: string | null;
    requirements?: Record<string, unknown> | null;
    fuel_surcharge?: number;
    accessorial_charge?: number;
    rpm?: number;
    commission_rate?: number | null;
    commodities?: Array<{
        description?: string;
        type?: string;
        quantity?: number;
        weight?: number;
        dimensions?: string;
        note?: string;
    }>;
    detailed_stops?: Array<{
        stop_type?: string;
        date_time?: string;
        company_name?: string;
        address?: string;
        notes?: string;
    }>;
}
export interface PaginatedLoadsResponse {
    data: LoadRecord[];
    total_count: number;
    page: number;
    total_pages: number;
}
export interface LoadsListParams {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    timeframe?: 'mtd' | 'ytd' | 'all' | 'custom';
    date_from?: string;
    date_to?: string;
}
export interface LoadDocumentRecord {
    id: number;
    document_type?: string | null;
    category?: string | null;
    file_name?: string | null;
    file_path?: string | null;
    file_url?: string | null;
    uploaded_at?: string | null;
}
export interface ActiveDriverContext {
    id: number;
    driver_name?: string | null;
    load_id?: number | null;
    load_status?: string | null;
}
export interface TruckRecord {
    id: number;
    truck_number?: string | null;
    trailer_number?: string;
    asset_type?: "truck" | "standalone_trailer";
    driver_id?: number | null;
    co_driver_id?: number | null;
    driver_name?: string | null;
    co_driver_name?: string | null;
    co_driver_cdl?: string | null;
    co_driver_phone?: string | null;
    co_driver_email?: string | null;
    co_driver_pay_percentage?: number | null;
    equipment_type?: string;
    status?: string;
    is_oos?: boolean;
    oos_since?: string | null;
    vin?: string;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    active_driver?: ActiveDriverContext | null;
    custom_fields?: Record<string, string>;
    performance_metrics?: TruckPerformanceMetrics;
    assigned_user_id?: number | null;
}
export interface TruckPerformanceMetrics {
    gross_revenue?: number;
    total_miles?: number;
    avg_mpg?: number;
    fuel_spent?: number;
    maintenance_costs?: number;
}
export type FleetAssetsTimeframe = 'mtd' | 'ytd' | 'all' | 'custom';
export interface FleetSummaryAsset {
    truck_id: number;
    truck_number?: string | null;
    status?: string | null;
    lat?: number | null;
    lng?: number | null;
    location_name?: string | null;
    updated_at?: string | null;
}
export interface FleetSummary {
    total_fleet_miles_driven: number;
    assets: FleetSummaryAsset[];
}
export interface FleetTruckFinancialRow {
    truck_id: number;
    truck_number?: string | null;
    driver_name?: string | null;
    gross_revenue: number;
    total_miles: number;
    avg_rpm: number;
}
export interface FleetFinancialsResponse {
    rows: FleetTruckFinancialRow[];
}
export interface AssetExpenseBreakdownRow {
    category: string;
    amount: number;
}
export interface AssetProfitability {
    truck_id: number;
    truck_number?: string | null;
    period_start: string;
    period_end: string;
    total_miles: number;
    gross_revenue: number;
    maintenance_cost: number;
    fuel_cost: number;
    driver_settlement_cost: number;
    total_operating_cost: number;
    net_profit: number;
    cost_per_mile: number;
    fleet_avg_cpm: number;
    cpm_target: number;
    cpm_status: string;
    expense_breakdown: AssetExpenseBreakdownRow[];
}
export interface CompanyProfile {
    id: number;
    name: string;
    slug?: string | null;
    dot_number?: string | null;
    mc_number?: string | null;
    phone?: string | null;
    eld_provider?: string | null;
    eld_connected_at?: string | null;
    eld_configured?: boolean;
}
export interface SystemSettings {
    dispatchers_can_view: boolean;
    dispatchers_can_edit: boolean;
    include_in_compliance_exports: boolean;
}
export interface UserProfile {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    roles?: string[];
}
export interface CompanyUserRecord {
    id: number;
    email: string;
    company_id: number;
    roles: string[];
    created_at?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    commission_rate?: number;
}
export interface TeamDispatcher {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name: string;
    roles?: string[];
    commission_rate?: number | null;
}
export interface DriverRecord {
    id: number;
    driver_name: string;
    pay_percentage?: number;
    cdl_number?: string;
    phone_number?: string;
    email?: string;
    driver_type?: string;
    status?: string;
    custom_fields?: Record<string, string>;
    assigned_user_id?: number | null;
    planning_color?: string | null;
    empty_override_date?: string | null;
}
export interface DriverPlanningRow {
    id: number;
    driver_name: string;
    driver_type: string;
    status: string;
    cdl_number?: string | null;
    phone_number?: string | null;
    pay_percentage: number;
    comments?: string | null;
    truck_number?: string | null;
    trailer_number?: string | null;
    cdl_expiration_date?: string | null;
    medical_card_expiration_date?: string | null;
    twic_expiration_date?: string | null;
    gross_pay: number;
    avg_rpm: number;
    total_loaded_miles: number;
    load_count: number;
    active_load_id?: number | null;
    est_empty_location?: string | null;
    delivery_date?: string | null;
    window_start: string;
    window_end: string;
    assigned_user_id?: number | null;
    truck_id?: number | null;
    planning_color?: string | null;
    empty_override_date?: string | null;
    schedule_loads?: Array<{
        id: number;
        broker_load_id?: string | null;
        origin: string;
        destination: string;
        status: string;
        pickup_date?: string | null;
        delivery_date?: string | null;
    }>;
    day_statuses?: Record<string, string | {
        id?: string;
        date?: string;
        status: string;
        location?: string | null;
        description?: string | null;
        rc_url?: string | null;
        rc_file_name?: string | null;
    }>;
}
export interface DriverDocumentUploadResult {
    status: string;
    id: number;
    file_path?: string | null;
    file_url?: string | null;
    document_type?: string | null;
    uploaded_at?: string;
    scan?: {
        document_type: string;
        expiration_date: string;
        confidence: number;
        raw_text: string;
    } | null;
    driver?: {
        id: number;
        cdl_expiration_date: string | null;
        medical_card_expiration_date: string | null;
    };
}
export interface LicenseExtraction {
    full_name?: string | null;
    license_number?: string | null;
    state?: string | null;
    expiration_date?: string | null;
}
export interface MedicalCardExtraction {
    full_name?: string | null;
    expiration_date?: string | null;
    certificate_number?: string | null;
}
export interface TwicCardExtraction {
    full_name?: string | null;
    expiration_date?: string | null;
}
export interface DriverDocumentParseResult {
    document_type: string;
    license?: LicenseExtraction | null;
    medical_card?: MedicalCardExtraction | null;
    twic_card?: TwicCardExtraction | null;
    confidence?: number | null;
}
export interface DriverDocumentAttachment {
    document_type: string;
    file: File;
    extraction?: DriverDocumentParseResult | null;
}
export interface DriverProfileLoad {
    id: number;
    broker_load_id?: string | null;
    origin: string;
    destination: string;
    status: string;
    gross_pay: number;
    total_miles: number;
    deadhead_miles: number;
    created_at?: string | null;
}
export interface DriverProfileSettlement {
    id: number;
    statement_number: string;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    created_at?: string | null;
    gross_driver_pay: number;
    total_deductions: number;
    net_driver_pay: number;
    load_count: number;
    deductions: {
        id: number;
        description: string;
        amount: number;
    }[];
}
export interface DriverProfile {
    id: number;
    driver_name: string;
    driver_type: string;
    status: string;
    cdl_number?: string | null;
    phone_number?: string | null;
    email?: string | null;
    pay_percentage: number;
    comments?: string | null;
    truck_number?: string | null;
    trailer_number?: string | null;
    cdl_expiration_date?: string | null;
    medical_card_expiration_date?: string | null;
    twic_expiration_date?: string | null;
    expiration_warnings: string[];
    documents: DriverDocumentRecord[];
    loads: DriverProfileLoad[];
    financials: {
        lifetime_gross_revenue: number;
        lifetime_loaded_miles: number;
        lifetime_empty_miles: number;
        lifetime_total_miles: number;
        load_count: number;
    };
    settlements: DriverProfileSettlement[];
}
export interface DriverDocumentRecord {
    id: number;
    document_type?: string | null;
    file_name?: string | null;
    file_path?: string | null;
    file_url?: string | null;
    notes?: string | null;
    uploaded_at?: string;
}
export interface EntityCustomFolderRecord {
    id: number;
    company_id: number;
    entity_type: 'TRUCK' | 'TRAILER' | 'DRIVER';
    folder_name: string;
    truck_id?: number | null;
    trailer_id?: number | null;
    driver_id?: number | null;
}
export type EntityCustomFolderScope = {
    truckId?: number;
    trailerId?: number;
    driverId?: number;
};
export interface FuelEntryRecord {
    id: number;
    truck_id: number | null;
    driver_id?: number | null;
    state: string;
    gallons: number;
    total_cost: number;
    date: string;
}
export interface LedgerLine {
    id: string;
    transaction_type: 'revenue' | 'expense';
    reference: string;
    amount: number;
    transaction_date: string | null;
    truck_id: number | null;
    truck_number: string | null;
    driver_id: number | null;
    driver_name: string;
    document_url: string | null;
    document_file_path: string | null;
    has_document: boolean;
    source_id: number;
    source_kind: 'load' | 'fuel';
    gallons?: number;
    state?: string;
}
export interface LedgerSummary {
    total_revenue: number;
    total_expenses: number;
    net: number;
    line_count: number;
}
export interface FinancialTrendMetrics {
    revenue_pct: number;
    expenses_pct: number;
    net_profit_pct: number;
}
export interface FinancialCashFlowWeek {
    label: string;
    inflow: number;
    outflow: number;
}
export interface FinancialCashFlow {
    weeks: FinancialCashFlowWeek[];
    total_cash_inflow: number;
    total_cash_outflow: number;
    net_cash_flow: number;
}
export interface FinancialRecentTransaction {
    id: number;
    title: string;
    amount: number;
    type: 'REVENUE' | 'EXPENSE';
    timestamp: string;
}
export interface FinancialRecentTransactionsFeed {
    data: FinancialRecentTransaction[];
}
export interface BankStagedMatchRow {
    target_type: string;
    target_id: number;
    confidence: 'EXACT' | 'HIGH' | 'PARTIAL' | string;
    target_description: string;
    ledger_transaction_id?: number | null;
}
export interface BankTransactionRow {
    id: number;
    date: string;
    description: string;
    amount: number;
    source: string;
    reconciled: boolean;
    suggested_ledger_id?: number | null;
    suggested_ledger_label?: string | null;
    suggested_ledger_amount?: number | null;
    suggested_ledger_signed_amount?: number | null;
    suggested_ledger_date?: string | null;
    staged_match?: BankStagedMatchRow | null;
}
export interface LedgerCandidateRow {
    id: number;
    label: string;
    amount: number;
    signed_amount: number;
    transaction_date: string;
    type: 'REVENUE' | 'EXPENSE' | string;
}
export interface BankTransactionsResponse {
    connected: boolean;
    source: string;
    data: BankTransactionRow[];
    ledger_candidates: LedgerCandidateRow[];
}
export interface BankConnectRequest {
    public_token: string;
    institution_name?: string | null;
    account_mask?: string | null;
    item_id?: string | null;
    company_id?: number | null;
}
export interface BankConnectResponse {
    connected: boolean;
    source: string;
    item_id?: string | null;
    link_status: string;
}
export interface BankMatchRequest {
    bank_transaction_id: number;
    ledger_transaction_id: number;
}
export interface BankMatchResponse {
    bank_transaction_id: number;
    ledger_transaction_id: number;
    reconciled: boolean;
    variance: number;
    discrepancy_writeoff_id?: number | null;
}
export interface BankAutoMatchResultRow extends BankStagedMatchRow {
    bank_transaction_id: number;
}
export interface BankAutoMatchResponse {
    staged_count: number;
    matches: BankAutoMatchResultRow[];
}
export interface BankApproveStagedMatchRequest {
    bank_transaction_id: number;
}
export interface DriverSettlementFinalizeResult {
    id: number;
    statement_number: string;
    status: string;
    net_payout: number;
}
export interface FinancialAccountingSummary {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    cash_balance: number;
    accounts_receivable: number;
    ar_customers: number;
    accounts_payable: number;
    trends: FinancialTrendMetrics;
    profit_loss?: FinancialProfitAndLoss;
    recent_transactions?: FinancialRecentTransaction[];
}
export interface FinancialDailyChartPoint {
    date: string;
    revenue: number;
    expenses: number;
}
export interface FinancialProfitAndLoss {
    total_revenue: number;
    cost_of_sales: number;
    gross_profit: number;
    gross_margin_pct: number;
    fuel_ifta_expenses?: number;
    operating_expenses: number;
    net_profit: number;
    net_margin_pct: number;
}
export interface FinancialAccountingCharts {
    range_type: string;
    timeline: FinancialDailyChartPoint[];
    profit_and_loss: FinancialProfitAndLoss;
    profit_loss?: FinancialProfitAndLoss;
}
export interface FinancialInvoiceRow {
    id: number;
    invoice_number: string;
    customer_name: string;
    load_id: number | null;
    broker_load_id?: string | null;
    load_trip: string | null;
    invoice_date: string;
    due_date: string;
    amount: number;
    balance: number;
    status: string;
    is_factored?: boolean;
    factoring_fee_percentage?: number | null;
    factoring_fee_amount?: number | null;
    reserve_percentage?: number | null;
    reserve_held_amount?: number | null;
    advance_amount?: number | null;
    factoring_status?: string;
    factoring_batch_id?: number | null;
    advance_rate_percentage?: number | null;
}
export const FACTORING_PROFILES = [
    {
        index: 0,
        name: 'Triumph Capital 90/2.5',
        advance_rate_percentage: 90,
        factoring_fee_percentage: 2.5,
    },
    {
        index: 1,
        name: 'OTR Solutions 92/2.75',
        advance_rate_percentage: 92,
        factoring_fee_percentage: 2.75,
    },
    {
        index: 2,
        name: 'RTS Premium 95/3.0',
        advance_rate_percentage: 95,
        factoring_fee_percentage: 3,
    },
] as const;
const moneyRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function computeBatchFactoringMetrics(invoices: FinancialInvoiceRow[], profileIndex: number) {
    const profile = FACTORING_PROFILES.find((entry) => entry.index === profileIndex) ?? FACTORING_PROFILES[0];
    let totalGross = 0;
    let totalAdvance = 0;
    let totalFees = 0;
    let totalReserve = 0;
    const lines = invoices.map((invoice) => {
        const grossValue = moneyRound(Math.max(0, invoice.amount));
        const advanceCash = moneyRound(grossValue * (profile.advance_rate_percentage / 100));
        const serviceFee = moneyRound(grossValue * (profile.factoring_fee_percentage / 100));
        const reserveEscrow = moneyRound(grossValue - advanceCash - serviceFee);
        totalGross += grossValue;
        totalAdvance += advanceCash;
        totalFees += serviceFee;
        totalReserve += reserveEscrow;
        return {
            invoiceId: invoice.id,
            grossValue,
            advanceCash,
            serviceFee,
            reserveEscrow,
        };
    });
    return {
        profileIndex: profile.index,
        profileName: profile.name,
        totalGross: moneyRound(totalGross),
        totalAdvance: moneyRound(totalAdvance),
        totalFees: moneyRound(totalFees),
        totalReserve: moneyRound(totalReserve),
        lines,
    };
}
export interface FinancialFactorBatchPayload {
    invoice_ids: number[];
    profile_index: number;
}
export interface FinancialFactorBatchResult {
    batch_id: number;
    tracking_id: string;
    profile_index: number;
    profile_name: string;
    invoice_count: number;
    total_gross: number;
    total_advance: number;
    total_fees: number;
    total_reserve: number;
    invoice_ids: number[];
}
export interface FinancialInvoicesPage {
    data: FinancialInvoiceRow[];
    total: number;
    page: number;
    limit: number;
}
export interface FinancialUninvoicedLoad {
    id: number;
    broker_load_id: string | null;
    broker_name: string | null;
    origin: string;
    destination: string;
    status: string;
    gross_amount: number;
}
export interface FinancialInvoiceCreatePayload {
    load_id: number;
    broker_name?: string;
    invoice_number?: string;
    amount?: number;
    invoice_date?: string;
    due_date?: string;
    is_factored?: boolean;
    factoring_fee_percentage?: number;
    reserve_percentage?: number;
}
export interface FinancialInvoiceCreateResult {
    id: number;
    invoice_number: string;
    customer_name: string;
    load_id: number;
    invoice_date: string;
    due_date: string;
    amount: number;
    balance: number;
    status: string;
    is_factored?: boolean;
    factoring_fee_percentage?: number | null;
    factoring_fee_amount?: number | null;
    reserve_percentage?: number | null;
    reserve_held_amount?: number | null;
    advance_amount?: number | null;
}
export interface FinancialInvoiceUpdatePayload {
    status?: string;
    balance?: number;
    is_factored?: boolean;
    factoring_fee_percentage?: number;
    reserve_percentage?: number;
}
export interface FinancialInvoiceUpdateResult {
    id: number;
    invoice_number: string;
    status: string;
    balance: number;
    ledger_transaction_id?: number | null;
}
export interface FinancialBillRow {
    id: number;
    vendor_name: string;
    category: string;
    bill_date: string;
    due_date: string;
    amount: number;
    balance: number;
    status: string;
}
export interface FinancialBillsPage {
    data: FinancialBillRow[];
    total: number;
    page: number;
    limit: number;
}
export type VendorBillCategory = 'Maintenance' | 'Office Supply' | 'Insurance' | 'Fuel' | 'Software' | 'Other';
export interface FinancialBillCreatePayload {
    vendor_name: string;
    category: VendorBillCategory;
    bill_date: string;
    due_date: string;
    amount: number;
}
export interface FinancialBillCreateResult {
    id: number;
    vendor_name: string;
    category: string;
    bill_date: string;
    due_date: string;
    amount: number;
    balance: number;
    status: string;
}
export interface FinancialBillPayResult {
    id: number;
    vendor_name: string;
    status: string;
    balance: number;
    paid_amount: number;
    ledger_transaction_id: number;
    payment_amount: number;
}
export interface FinancialPaymentRow {
    id: string;
    source_id: number;
    direction: 'incoming' | 'outgoing' | string;
    counterparty: string;
    payment_date: string;
    amount: number;
    source_type: string;
    reference: string;
}
export interface FinancialPaymentsPage {
    data: FinancialPaymentRow[];
    total: number;
    page: number;
    limit: number;
}
export interface FinancialJournalEntryLine {
    id: number;
    account_id: number;
    account_code: string;
    account_name: string;
    account_category: string;
    debit_amount: number;
    credit_amount: number;
}
export interface FinancialJournalEntryRow {
    id: number;
    entry_number: string;
    transaction_date: string;
    memo: string;
    total_debit: number;
    total_credit: number;
    account_tags: string[];
    lines: FinancialJournalEntryLine[];
}
export interface FinancialJournalEntriesPage {
    data: FinancialJournalEntryRow[];
    total: number;
    page: number;
    limit: number;
}
export type ChartOfAccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export interface ChartOfAccountRow {
    id: number;
    account_code: string;
    account_name: string;
    account_type: ChartOfAccountType | string;
    is_active: boolean;
    display_label: string;
}
export interface ChartOfAccountsResponse {
    data: ChartOfAccountRow[];
}
export interface FinancialJournalLineInput {
    account_id: number;
    debit_amount: number;
    credit_amount: number;
}
export interface FinancialJournalEntryCreatePayload {
    memo: string;
    transaction_date: string;
    lines: FinancialJournalLineInput[];
}
export interface FinancialJournalEntryCreateResult {
    id: number;
    entry_number: string;
    transaction_date: string;
    memo: string;
    total_debit: number;
    total_credit: number;
    ledger_transaction_ids: number[];
}
export interface FinancialLockedPeriod {
    year: number;
    month: number;
    label: string;
    locked_at: string;
    locked_by_user_id?: number | null;
}
export interface FinancialPeriodClosingHealth {
    unreconciled_bank_lines: number;
    unpaid_bills: number;
    unpaid_bill_total: number;
    locked_periods: FinancialLockedPeriod[];
    ready_to_close: boolean;
}
export interface FinancialPeriodLockResult {
    year: number;
    month: number;
    label: string;
    locked_at: string;
    locked_by_user_id: number;
}
export interface FinancialTaxCategoryRow {
    category: string;
    amount: number;
    line_type: string;
}
export interface FinancialTrialBalanceRow {
    account: string;
    debit: number;
    credit: number;
}
export interface FinancialTaxSummary {
    period_label: string;
    start_date: string;
    end_date: string;
    categories: FinancialTaxCategoryRow[];
    total_revenue: number;
    total_expenses: number;
    net_taxable_income: number;
    trial_balance: FinancialTrialBalanceRow[];
}
export interface FinancialAgingBucket {
    tier: string;
    amount: number;
    pct: number;
}
export interface FinancialAgingSummary {
    total_ar: number;
    buckets: FinancialAgingBucket[];
    breakdown?: Record<string, {
        pct?: number;
        amount?: number;
    }>;
}
export interface FuelIftaVehicleSpendRow {
    truck: string;
    amount: number;
    pct: number;
}
export interface FuelIftaJurisdictionRow {
    state: string;
    code: string;
    miles: number;
}
export interface FuelIftaFuelTypeRow {
    label: string;
    miles: number;
    pct: number;
}
export interface FuelIftaSummaryPanel {
    total_miles: number;
    taxable_miles: number;
    jurisdictions_traveled: number;
    est_tax_due: number;
    credits: number;
    balance_due: number;
}
export interface FuelSpendDayRow {
    day: string;
    label: string;
    spend: number;
}
export interface IftaStateTaxRow {
    state: string;
    code: string;
    miles: number;
    gallons: number;
    tax_rate: number;
    tax_on_miles: number;
    tax_on_fuel: number;
    est_tax_due: number;
    credit: number;
    net_liability: number;
}
export interface IftaJurisdictionBreakdownRow {
    state: string;
    miles: number;
    gallons_purchased: number;
    tax_paid: number;
    net_tax_due: number;
}
export interface IftaJurisdictionMatrixRow {
    state_code: string;
    state_name: string;
    total_miles: number;
    taxable_gallons: number;
    paid_gallons: number;
    tax_rate: number;
    net_tax_owed: number;
    available_credits: number;
    net_liability: number;
}
export interface IftaQuarterlySummary {
    company_id: number;
    year: number;
    quarter: number;
    quarter_label: string;
    period_start: string;
    period_end: string;
    fleet_mpg: number;
    total_miles: number;
    total_gallons: number;
    total_tax_due: number;
    total_credits: number;
    balance_due: number;
    jurisdiction_matrix: IftaJurisdictionMatrixRow[];
    is_locked?: boolean;
    tracking_id?: string | null;
    snapshot_hash?: string | null;
    locked_at?: string | null;
}
export interface IftaReportRecord {
    id: number;
    company_id: number;
    title: string;
    quarter: number;
    year: number;
    start_date: string;
    end_date: string;
    total_miles: number;
    total_gallons: number;
    tax_due: number;
    status: string;
    jurisdiction_breakdown: IftaJurisdictionBreakdownRow[];
    created_at?: string | null;
}
export interface IftaReportCreatePayload {
    title: string;
    quarter: number;
    year: number;
    start_date: string;
    end_date: string;
    jurisdiction_entries: Array<{
        state: string;
        miles: number;
        gallons_purchased: number;
    }>;
}
export interface FuelIftaFinancialSummary {
    total_fuel_spend: number;
    total_gallons: number;
    avg_price_per_gallon: number;
    fleet_avg_mpg?: number;
    ifta_days_remaining?: number;
    ifta_deadline?: string;
    ifta_quarter_label?: string;
    vehicle_spend?: FuelIftaVehicleSpendRow[];
    jurisdiction_miles?: FuelIftaJurisdictionRow[];
    fuel_type_miles?: FuelIftaFuelTypeRow[];
    fuel_spend_series?: FuelSpendDayRow[];
    state_tax_rows?: IftaStateTaxRow[];
    ifta?: FuelIftaSummaryPanel;
}
export interface FuelIftaSummaryQuery {
    quarter?: string | null;
    date_range?: string | null;
}
export interface FuelIftaTransactionRow {
    id: number;
    transaction_date: string;
    truck_id: number | null;
    vehicle: string | null;
    driver_id: number | null;
    driver_name: string | null;
    location: string | null;
    location_state?: string | null;
    fuel_type: string;
    gallons: number;
    price_per_gallon: number;
    total_amount: number;
    odometer: number | null;
    purchase_type: string;
    receipt_url: string | null;
}
export interface FuelIftaTransactionsPage {
    data: FuelIftaTransactionRow[];
    total_count: number;
    page: number;
    pages: number;
    limit: number;
    total?: number;
}
export interface FuelIftaTransactionsQuery {
    vehicle_id?: number | null;
    date_range?: string | null;
    quarter?: string | null;
    search?: string;
    fuel_type?: string;
    type?: string;
    has_receipt?: boolean;
    page?: number;
    limit?: number;
}
export interface FuelTransactionCreatePayload {
    date: string;
    vehicle_id?: number | null;
    driver_id?: number | null;
    location_state: string;
    fuel_type: string;
    gallons: number;
    price_per_gallon: number;
    odometer?: number | null;
    receipt_url?: string | null;
}
export interface FuelCardImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}
export interface FuelIftaFilingHistoryRow {
    quarter_label: string;
    filed_date: string;
    amount_due: number;
    tax_amount: number;
    status: 'Filed' | 'Pending' | 'Draft' | string;
}
export interface FuelIftaFilingsHistory {
    data: FuelIftaFilingHistoryRow[];
}
export interface EtaBoardRow {
    load_id: number;
    truck_number: string;
    driver_name: string;
    destination: string;
    hard_deadline: string;
    calculated_eta: string;
    eta_hours_remaining: number;
    miles_traveled?: number;
    status: 'Delayed' | 'On Time' | 'Out of Route' | string;
    current_lat: number;
    current_lng: number;
    heading?: number;
    simulated?: boolean;
}
export interface MobileDeviceRow {
    id: number;
    driver_id?: number | null;
    driver_name?: string | null;
    device_uuid?: string | null;
    device_model?: string | null;
    device_os?: string | null;
    provisioning_state: string;
    pairing_code?: string | null;
    pairing_code_expires_at?: string | null;
    last_ping_at?: string | null;
}
export interface MobileDevicesResponse {
    devices: MobileDeviceRow[];
}
export interface MobilePairingCodeResult {
    device_id: number;
    driver_id: number;
    pairing_code: string;
    expires_at: string;
    provisioning_state: string;
}
export interface TelemetryTrailPoint {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    recorded_at: string;
}
export interface TelemetryTrailRow {
    load_id?: number | null;
    driver_id: number;
    truck_id?: number | null;
    points: TelemetryTrailPoint[];
}
export interface TelemetryTrailsResponse {
    trails: TelemetryTrailRow[];
}
export interface TelemetryMapMarker {
    loadId: number;
    latitude: number | null;
    longitude: number | null;
    heading?: number | null;
}
export interface TelemetryMapTrailPoint {
    lat: number;
    lng: number;
}
export interface TelemetryMapTrail {
    loadId: number | null;
    points: TelemetryMapTrailPoint[];
}
export interface RadarHeatmapZone {
    lat: number;
    lng: number;
    cityName: string;
    weight: number;
    avgRate: number;
    avgRpm: number;
    mci?: number;
    tier?: string;
    stateCode?: string;
    stateName?: string;
    marketNote?: string;
}
export interface MarketIntelligenceState {
    state_code: string;
    state_name: string;
    hub_city: string;
    lat: number;
    lng: number;
    active_loads: number;
    avg_rpm: number;
    mci: number;
    tier: string;
    market_note: string;
}
export interface MarketIntelligenceResponse {
    source: string;
    state_count: number;
    zone_count: number;
    states: MarketIntelligenceState[];
    zones: RadarHeatmapZone[];
}
export interface TrashLoadItem {
    id: number;
    load_id: string;
    broker_name: string;
    origin: string;
    destination: string;
    gross_pay: number;
    deleted_at: string | null;
}
export interface BillingLoadItem {
    id: number;
    load_id: string;
    broker_name: string;
    origin: string;
    destination: string;
    gross_pay: number;
    payment_status: string;
    operational_status: string;
    ar_status?: string | null;
    delivered_at?: string | null;
    funded_at?: string | null;
}
export interface ARTrackerBuckets {
    PENDING_FACTORING: BillingLoadItem[];
    FUNDED: BillingLoadItem[];
    HELD_DISPUTED: BillingLoadItem[];
    DIRECT_BILL: BillingLoadItem[];
}
export interface RadarSpotLoad {
    id: number;
    source_board: string;
    origin: string;
    destination: string;
    total_gross_rate: number;
    loaded_miles: number;
    deadhead_miles: number;
    total_miles: number;
    true_rpm: number;
    broker_mc: string;
    broker_name: string;
    broker_status: string;
    exit_market_score: number;
    exit_market_trend: string;
    ai_score: number;
}
export interface FuelCreatePayload {
    truck_id: number | null;
    state: string;
    gallons: number;
    total_cost: number;
}
export interface IftaSummary {
    total_gallons: number;
    total_fuel_cost: number;
    fleet_mpg: number;
    state_breakdown: Array<{
        state: string;
        gallons: number;
    }>;
}
export interface IftaStateMileageRow {
    state: string;
    miles: number;
    gallons?: number | null;
}
export interface IftaMileageSummary {
    truck_id: number;
    truck_number: string;
    start_date: string;
    end_date: string;
    total_miles: number;
    ping_count: number;
    state_mileage: Record<string, number>;
    states: IftaStateMileageRow[];
}
export interface AnalyticsSummary {
    monthly_gross: number;
    monthly_net: number;
    monthly_rpm: number;
    monthly_gross_rpm: number;
    monthly_net_rpm: number;
    monthly_miles: number;
    monthly_loaded_miles: number;
    monthly_deadhead_miles: number;
    monthly_fleet_miles: number;
}
export interface UnbatchedLoad {
    id: number;
    broker_load_id: string | null;
    origin: string;
    destination: string;
    linehaul_rate: number;
    driver_pay_allocated: number;
    payment_status?: string | null;
    status?: string | null;
    activity_date?: string | null;
    created_at: string;
    truck_id?: number;
}
export interface SettlementDeduction {
    id: number;
    description: string;
    amount: number;
}
export interface SettlementStatement {
    id: number;
    statement_number: string;
    created_at: string;
    gross_driver_pay: number;
    total_deductions: number;
    net_driver_pay: number;
    status: string;
    load_count: number;
    deductions: SettlementDeduction[];
}
export interface DriverSettlementDeductionBreakdown {
    escrow: number;
    insurance: number;
    dispatch_fees: number;
    other: number;
}
export interface DriverSettlementLedgerRow {
    id: number;
    driver_id: number;
    driver_name: string;
    statement_number: string;
    period_start: string;
    period_end: string;
    gross_revenue: number;
    deductions: DriverSettlementDeductionBreakdown;
    fuel_advances: number;
    net_payout: number;
    status: string;
    load_count: number;
}
export type PayrollRecipientType = 'DRIVER' | 'DISPATCHER' | 'STAFF';
export interface PayrollLedgerRow {
    id: number;
    recipient_type: PayrollRecipientType | string;
    recipient_name: string;
    statement_number: string;
    period_start: string;
    period_end: string;
    status: string;
    net_payout: number;
    driver_id?: number | null;
    truck_number?: string | null;
    total_miles?: number | null;
    gross_revenue?: number | null;
    deductions?: DriverSettlementDeductionBreakdown;
    fuel_advances?: number;
    load_count?: number | null;
    assigned_load_count?: number | null;
    total_dispatched_volume?: number | null;
    commission_rate?: number | null;
    hours?: number | null;
    base_payout?: number | null;
}
export interface PayrollPage {
    data: PayrollLedgerRow[];
    total: number;
    page: number;
    limit: number;
}
export interface PayrollFinalizeResult {
    id: number;
    recipient_type: string;
    statement_number: string;
    status: string;
    net_payout: number;
    ledger_category: string;
}
export interface SettlementLineItem {
    description: string;
    amount: number;
    source?: string;
}
export interface DriverSettlementLoadBreakdown {
    load_id: number;
    broker_load_id?: string | null;
    origin: string;
    destination: string;
    gross_pay: number;
    loaded_miles: number;
    empty_miles: number;
    linehaul_revenue: number;
}
export interface DriverSettlementCompileInput {
    driver_id: number;
    start_date: string;
    end_date: string;
    load_ids: number[];
    accessorials?: SettlementLineItem[];
    deductions?: SettlementLineItem[];
    include_fuel_advances?: boolean;
    commit?: boolean;
}
export interface DriverSettlementCompileResult {
    preview: boolean;
    tracking_id: string;
    driver_id: number;
    driver_name: string;
    pay_type: string;
    base_rate: number;
    empty_mile_rate: number;
    period_start: string;
    period_end: string;
    load_count: number;
    loads: DriverSettlementLoadBreakdown[];
    gross_driver_pay: number;
    total_accessorials: number;
    total_deductions: number;
    net_driver_pay: number;
    accessorials: SettlementLineItem[];
    deductions: SettlementLineItem[];
    settlement_id?: number | null;
    payroll_batch_id?: number | null;
    statement_number?: string | null;
}
export interface StaffPayrollBatchInput {
    user_id: number;
    hours: number;
    base_payout: number;
    total_deductions?: number;
    period_start?: string;
    period_end?: string;
}
export interface DispatcherPayrollBatchInput {
    dispatcher_user_id: number;
    commission_rate?: number;
}
export interface DispatcherUnbatchedGroup {
    dispatcher_user_id: number;
    dispatcher_name: string;
    commission_rate: number;
    load_count: number;
    total_gross_volume: number;
    projected_net_pay: number;
    loads: UnbatchedPayrollLoadRow[];
}
export interface DispatcherUnbatchedResponse {
    period_start: string;
    period_end: string;
    groups: DispatcherUnbatchedGroup[];
}
export interface UnbatchedPayrollLoadRow {
    id: number;
    broker_load_id?: string | null;
    origin: string;
    destination: string;
    linehaul_rate: number;
    driver_pay_allocated: number;
    payment_status?: string | null;
    status: string;
    activity_date?: string | null;
    created_at?: string | null;
    truck_id?: number | null;
}
export interface DriverSettlementsPage {
    data: DriverSettlementLedgerRow[];
    total: number;
    page: number;
    limit: number;
}
export interface AccountingLoad {
    id: number;
    load_id: string;
    driver_name: string;
    truck_number: string | null;
    trailer_number: string | null;
    origin: string;
    destination: string;
    gross_rate: number;
    pickup_date?: string | null;
    created_at?: string | null;
    payment_status?: string | null;
    document_file_path?: string | null;
    document_url?: string | null;
    has_rc_document?: boolean;
}
export interface GlobalSearchLoadResult {
    id: string;
    subtext?: string;
    status?: string;
    load_id: number;
}
export interface GlobalSearchDriverResult {
    id: string;
    subtext?: string;
    driver_id: number;
}
export interface GlobalSearchTrailerResult {
    id: string;
    subtext?: string;
    truck_id: number;
}
export interface GlobalSearchInvoiceResult {
    id: string;
    subtext?: string;
    load_id: number;
}
export interface GlobalSearchResponse {
    loads: GlobalSearchLoadResult[];
    drivers: GlobalSearchDriverResult[];
    trailers: GlobalSearchTrailerResult[];
    invoices: GlobalSearchInvoiceResult[];
}
export interface DismissedAlertsResponse {
    alert_ids: string[];
}
export interface AlertDismissResponse {
    status: string;
    alert_id: string;
}
export function createTmsApi(client: AxiosInstance) {
    return {
        loads: {
            list: (params?: LoadsListParams) => client
                .get<PaginatedLoadsResponse>('/api/loads', { params })
                .then((r) => r.data),
            listActive: () => client.get<LoadRecord[]>('/api/loads/active').then((r) => r.data),
            remove: (id: number) => client.delete(`/api/loads/${id}`),
            trash: () => client.get<{
                loads: TrashLoadItem[];
            }>('/api/loads/trash').then((r) => r.data.loads),
            restore: (id: number) => client.post<{
                status: string;
                message: string;
            }>(`/api/loads/${id}/restore`).then((r) => r.data),
            permanentDelete: (id: number) => client
                .delete<{
                status: string;
                message: string;
            }>(`/api/loads/${id}/permanent`)
                .then((r) => r.data),
            documents: (id: number) => client.get<LoadDocumentRecord[]>(`/api/loads/${id}/documents`).then((r) => r.data),
            updateStatus: (id: number, status: string) => client.patch(`/api/loads/${id}/status`, { status }),
            patch: (id: number, payload: {
                is_flagged?: boolean;
                comments?: string | null;
                linehaul_rate?: number;
                fuel_surcharge?: number;
                accessorial_charge?: number;
                truck_id?: number | null;
                status?: string;
            }) => client.patch(`/api/loads/${id}`, payload).then((response: unknown) => {
                const data = response &&
                    typeof response === 'object' &&
                    'data' in response &&
                    (response as {
                        data?: unknown;
                    }).data !== undefined
                    ? (response as {
                        data: LoadRecord;
                    }).data
                    : (response as LoadRecord);
                if (!data || typeof data !== 'object' || data.id == null) {
                    throw new Error('Invalid response payload structure');
                }
                return data;
            }),
            generateInvoice: (id: number) => client.post(`/api/loads/${id}/generate-invoice`),
            factor: (id: number) => client.post(`/api/loads/${id}/factor`),
            create: (payload: Record<string, unknown>) => client.post<LoadRecord>('/api/loads', payload).then((r) => r.data),
            confirm: (id: number, payload: Record<string, unknown>) => client.put<LoadRecord>(`/api/loads/${id}/confirm`, payload).then((r) => r.data),
            attachDocument: (loadId: number, file: File, documentType = 'Rate Confirmation') => {
                const formData = new FormData();
                formData.append('file', file, file.name);
                formData.append('document_type', documentType);
                return client.post(`/api/loads/${loadId}/documents`, formData);
            },
            postDocumentForm: (loadId: number, formData: FormData) => client.post(`/api/loads/${loadId}/documents`, formData),
        },
        fleet: {
            drivers: () => client.get<DriverRecord[]>('/api/drivers').then((r) => r.data),
            planningBoard: (params: {
                start_date: string;
                end_date: string;
            }) => client
                .get<DriverPlanningRow[]>('/api/drivers/planning-board', { params })
                .then((r) => r.data),
            updateDriverStatus: (driverId: number, status: string) => client
                .patch<{
                id: number;
                status: string;
            }>(`/api/drivers/${driverId}/status`, { status })
                .then((r) => r.data),
            setDriverDayStatus: (driverId: number, payload: {
                id?: string | null;
                date: string;
                status: string;
                location?: string | null;
                description?: string | null;
                rc_url?: string | null;
                rc_file_name?: string | null;
            }) => client
                .post<{
                id: number;
                duty_id: string;
                date: string;
                status: string;
                location?: string | null;
                description?: string | null;
                day_statuses: Record<string, {
                    id: string;
                    date: string;
                    status: string;
                    location?: string | null;
                    description?: string | null;
                    rc_url?: string | null;
                    rc_file_name?: string | null;
                }>;
            }>(`/api/drivers/${driverId}/status`, payload)
                .then((r) => r.data),
            clearDriverDayStatus: (driverId: number, dutyOrDateKey: string) => client
                .delete<{
                id: number;
                duty_id?: string;
                date?: string;
                day_statuses: Record<string, {
                    id: string;
                    date: string;
                    status: string;
                    location?: string | null;
                    description?: string | null;
                }>;
            }>(`/api/drivers/${driverId}/status/${encodeURIComponent(dutyOrDateKey)}`)
                .then((r) => r.data),
            assignPlanningLoad: (driverId: number, payload: {
                load_id: number;
                start_date: string;
                end_date: string;
            }) => client
                .post<{
                id: number;
                truck_id: number;
                driver_id: number;
                status: string;
                start_date: string;
                end_date: string;
            }>(`/api/drivers/${driverId}/planning/assign-load`, payload)
                .then((r) => r.data),
            updateDriverComments: (driverId: number, comments: string) => client
                .patch<{
                id: number;
                comments: string | null;
            }>(`/api/drivers/${driverId}/comments`, { comments })
                .then((r) => r.data),
            updateDriverPlanning: (driverId: number, payload: {
                planning_color?: string | null;
                mark_out_of_service?: boolean;
                return_to_service?: boolean;
            }) => client
                .patch<{
                id: number;
                planning_color: string | null;
                status: string;
            }>(`/api/drivers/${driverId}/planning`, payload)
                .then((r) => r.data),
            updateDriver: (driverId: number, payload: {
                cdl_number?: string | null;
                phone_number?: string | null;
                email?: string | null;
                pay_percentage?: number;
                driver_type?: string;
                comments?: string | null;
                cdl_expiration_date?: string | null;
                medical_card_expiration_date?: string | null;
                twic_expiration_date?: string | null;
            }) => client
                .patch<{
                id: number;
                cdl_number: string | null;
                phone_number: string | null;
                email: string | null;
                pay_percentage: number;
                driver_type: string;
                comments: string | null;
            }>(`/api/drivers/${driverId}`, payload)
                .then((r) => r.data),
            driverProfile: (driverId: number) => client.get<DriverProfile>(`/api/drivers/${driverId}/profile`).then((r) => r.data),
            driverDocuments: (driverId: number) => client.get<DriverDocumentRecord[]>(`/api/drivers/${driverId}/documents`).then((r) => r.data),
            uploadDriverDocument: (driverId: number, file: File, documentType = 'Driver Document') => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', documentType);
                return client
                    .post<DriverDocumentUploadResult>(`/api/drivers/${driverId}/documents`, formData)
                    .then((r) => r.data);
            },
            parseDriverDocument: (file: File, documentType: string) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', documentType);
                return client
                    .post<DriverDocumentParseResult>('/api/drivers/documents/parse', formData)
                    .then((r) => r.data);
            },
            uploadDriverDocuments: (driverId: number, documents: Array<{
                file: File;
                document_type: string;
            }>) => Promise.all(documents.map(({ file, document_type }) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', document_type);
                return client
                    .post<DriverDocumentUploadResult>(`/api/drivers/${driverId}/documents`, formData)
                    .then((r) => r.data);
            })),
            trucks: (params?: {
                power_units_only?: boolean;
            }) => client
                .get<TruckRecord[]>('/api/trucks', {
                params: params?.power_units_only ? { power_units_only: true } : undefined,
            })
                .then((r) => r.data),
            getTruck: (id: number) => client.get<TruckRecord>(`/api/trucks/${id}`).then((r) => r.data),
            getSummary: (params?: {
                timeframe?: FleetAssetsTimeframe;
                start_date?: string;
                end_date?: string;
            }) => client.get<FleetSummary>('/api/fleet/summary', { params }).then((r) => r.data),
            financials: (params?: {
                timeframe?: FleetAssetsTimeframe;
                time_range?: 'all';
                start_date?: string;
                end_date?: string;
            }) => client
                .get<FleetFinancialsResponse>('/api/fleet/financials', { params })
                .then((r) => r.data),
            createTruck: (payload: {
                truck_number?: string | null;
                trailer_number: string;
                vin?: string | null;
                year?: number | null;
                make?: string | null;
                model?: string | null;
                equipment_type: string;
                asset_type?: "truck" | "standalone_trailer";
                driver_id?: number | null;
                co_driver_id?: number | null;
                custom_fields?: Record<string, string>;
                samsara_vehicle_id?: string | null;
            }) => client.post<TruckRecord>('/api/trucks', payload).then((r) => r.data),
            updateTruck: (id: number, payload: {
                truck_number?: string | null;
                trailer_number: string;
                vin?: string | null;
                year?: number | null;
                make?: string | null;
                model?: string | null;
                equipment_type: string;
                driver_id: number | null;
                co_driver_id?: number | null;
                custom_fields: Record<string, string>;
                samsara_vehicle_id?: string | null;
            }) => client.put<TruckRecord>(`/api/trucks/${id}`, payload).then((r) => r.data),
            updateTruckStatus: (truckId: number, status: string) => client
                .post<{
                id: number;
                status: string;
            }>(`/api/fleet/trucks/${truckId}/status`, { status })
                .then((r) => r.data),
            updateTruckPlanningAssignment: (truckId: number, assignedUserId: number | null) => client
                .patch<{
                id: number;
                assigned_user_id: number | null;
            }>(`/api/trucks/${truckId}/planning-assignment`, { assigned_user_id: assignedUserId })
                .then((r) => r.data),
        },
        fuel: {
            list: () => client.get<FuelEntryRecord[]>('/api/fuel').then((r) => r.data),
            create: (payload: FuelCreatePayload) => client.post<FuelEntryRecord>('/api/fuel', payload).then((r) => r.data),
            uploadDocument: (fuelId: number, file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                return client.post(`/api/fuel/${fuelId}/documents`, formData);
            },
            parse: (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                return client
                    .post<{
                    state: string | null;
                    gallons: number | null;
                    total_cost: number | null;
                }>('/api/fuel/parse', formData)
                    .then((r) => r.data);
            },
            uploadReceiptScan: (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                return client
                    .post<{
                    extracted_data: {
                        state: string;
                        gallons: number;
                        total_cost: number;
                    };
                }>('/api/upload-fuel-receipt', formData)
                    .then((r) => r.data);
            },
            documents: (fuelId: number) => client.get(`/api/fuel/${fuelId}/documents`).then((r) => r.data),
        },
        ifta: {
            summary: () => client.get<IftaSummary>('/api/ifta').then((r) => r.data),
            mileageSummary: (params: {
                truck_id: number;
                start_date: string;
                end_date: string;
            }) => client
                .get<IftaMileageSummary>('/api/ifta/mileage-summary', { params })
                .then((r) => r.data),
            reports: () => client.get<IftaReportRecord[]>('/api/ifta/reports').then((r) => r.data),
            createReport: (payload: IftaReportCreatePayload) => client.post<IftaReportRecord>('/api/ifta/reports', payload).then((r) => r.data),
        },
        analytics: {
            get: (timeRange: '30d' | 'all') => client.get<AnalyticsSummary>(`/api/analytics?time_range=${timeRange}`).then((r) => r.data),
        },
        company: {
            me: () => client.get<CompanyProfile>('/api/company/me').then((r) => r.data),
            update: (payload: {
                name: string;
                phone?: string | null;
                mc_number?: string | null;
                dot_number?: string | null;
            }) => client.patch('/api/company/me', payload).then((r) => r.data),
        },
        users: {
            me: () => client.get<UserProfile>('/api/users/me').then((r) => r.data),
            dispatchers: () => client.get<{
                dispatchers: TeamDispatcher[];
            }>('/api/users/dispatchers').then((r) => r.data),
            update: (payload: {
                first_name: string;
                last_name: string;
            }) => client.patch<UserProfile>('/api/users/me', payload).then((r) => r.data),
        },
        system: {
            settings: () => client.get<SystemSettings>('/api/system/settings').then((r) => r.data),
            updateSettings: (payload: Partial<SystemSettings>) => client.patch<SystemSettings>('/api/system/settings', payload).then((r) => r.data),
            listUsers: () => client.get<{
                users: CompanyUserRecord[];
            }>('/api/system/users').then((r) => r.data.users),
            createUser: (payload: {
                email: string;
                password: string;
                roles: string[];
                commission_rate?: number;
            }) => client.post<CompanyUserRecord>('/api/system/users', payload).then((r) => r.data),
            updateUser: (userId: number, payload: {
                commission_rate: number;
            }) => client.patch<CompanyUserRecord>(`/api/system/users/${userId}`, payload).then((r) => r.data),
        },
        telemetry: {
            etaBoard: () => client.get('/api/v1/telemetry/eta-board').then((r) => r.data),
        },
        alerts: {
            listDismissed: () => client
                .get<DismissedAlertsResponse>('/api/alerts/dismissed')
                .then((r) => r.data.alert_ids),
            dismiss: (alertId: string) => client
                .post<AlertDismissResponse>(`/api/alerts/${encodeURIComponent(alertId)}/dismiss`)
                .then((r) => r.data),
        },
        documents: {
            uploadPlanning: (file: File, documentType = 'Rate Confirmation') => {
                const formData = new FormData();
                formData.append('file', file, file.name);
                formData.append('document_type', documentType);
                return client.post<{
                    status: string;
                    file_path?: string | null;
                    file_url?: string | null;
                    file_name?: string | null;
                }>('/api/documents/planning-upload', formData);
            },
            updateNotes: (documentId: number, notes: string) => client
                .patch<{
                id: number;
                notes: string | null;
            }>(`/api/documents/${documentId}/notes`, {
                notes,
            })
                .then((r) => r.data),
        },
        settlements: {
            unbatched: (driverId: number) => client
                .get<{
                loads: UnbatchedLoad[];
            }>(`/api/settlements/unbatched/${driverId}`)
                .then((r) => r.data),
            history: (driverId: number) => client
                .get<{
                statements: SettlementStatement[];
            }>(`/api/settlements/${driverId}`)
                .then((r) => r.data),
            create: (payload: {
                driver_id: number;
                load_ids: number[];
                deductions: Array<{
                    description: string;
                    amount: number;
                }>;
            }) => client.post('/api/settlements', payload).then((r) => r.data),
            finalize: (settlementId: number) => client.patch(`/api/settlements/${settlementId}/finalize`).then((r) => r.data),
            document: (settlementId: number) => client
                .get<{
                settlement_id: number;
                statement_number: string;
                file_name?: string | null;
                url?: string | null;
                file_url?: string | null;
                file_path?: string | null;
            }>(`/api/settlements/${settlementId}/document`)
                .then((r) => r.data),
        },
        radar: {
            heatmapSummary: () => client
                .get<{
                zones: RadarHeatmapZone[];
                source?: string;
            }>('/api/radar/heatmap-summary')
                .then((r) => r.data),
            spotLoads: (params?: {
                min_rate?: number;
                min_exit_score?: number;
                hide_unverified?: boolean;
            }) => client
                .get<RadarSpotLoad[]>('/api/radar/spot-loads', { params })
                .then((r) => r.data),
            ingestEmail: (emailBody: string) => client
                .post<{
                status: string;
                parsed_count: number;
                saved_count: number;
                loads: unknown[];
            }>('/api/radar/ingest-email', { email_body: emailBody })
                .then((r) => r.data),
        },
        marketIntelligence: {
            summary: () => client.get<MarketIntelligenceResponse>('/api/market-intelligence').then((r) => r.data),
        },
        accounting: {
            billingQueue: () => client.get<{
                loads: BillingLoadItem[];
            }>('/api/accounting/billing-queue').then((r) => r.data),
            arTracker: () => client.get<ARTrackerBuckets>('/api/accounting/ar-tracker').then((r) => r.data),
            batchFactor: (loadIds: number[]) => client
                .post<{
                status: string;
                submitted_count: number;
                failed_count: number;
                submissions: unknown[];
                errors: Array<{
                    load_id: number;
                    detail: string;
                }>;
            }>('/api/accounting/batch-factor', { load_ids: loadIds })
                .then((r) => r.data),
            assetProfitability: (assetId: number, params: {
                start_date: string;
                end_date: string;
            }) => client
                .get<AssetProfitability>(`/api/accounting/assets/${assetId}/profitability`, { params })
                .then((r) => r.data),
            calculate: (payload: {
                search_query?: string;
                truck_id?: number | null;
                start_date: string | null;
                end_date: string | null;
                custom_fees: Array<{
                    name: string;
                    percentage: number;
                }>;
            }) => client
                .post<{
                loads: AccountingLoad[];
            }>('/api/accounting/calculate', payload)
                .then((r) => r.data),
            ledger: (params?: {
                start_date?: string | null;
                end_date?: string | null;
                truck_id?: number | null;
            }) => {
                const query = new URLSearchParams();
                if (params?.start_date)
                    query.set('start_date', params.start_date);
                if (params?.end_date)
                    query.set('end_date', params.end_date);
                if (params?.truck_id != null)
                    query.set('truck_id', String(params.truck_id));
                const qs = query.toString();
                return client
                    .get<{
                    lines: LedgerLine[];
                    summary: LedgerSummary;
                }>(`/api/accounting/ledger${qs ? `?${qs}` : ''}`)
                    .then((r) => r.data);
            },
        },
        financials: {
            accountingSummary: (rangeType = 'This Month') => client
                .get<FinancialAccountingSummary>('/api/financials/accounting/summary', {
                params: { range_type: rangeType },
            })
                .then((r) => r.data),
            accountingCharts: (rangeType = 'This Month') => client
                .get<FinancialAccountingCharts>('/api/financials/accounting/charts', {
                params: { range_type: rangeType },
            })
                .then((r) => r.data),
            accountingInvoices: (params?: {
                search?: string;
                status?: string;
                customer?: string;
                customer_id?: number;
                month?: string;
                page?: number;
                limit?: number;
            }) => client
                .get<FinancialInvoicesPage>('/api/financials/accounting/invoices', {
                params: {
                    search: params?.search || undefined,
                    status: params?.status && params.status !== 'All' ? params.status : undefined,
                    customer: params?.customer && params.customer !== 'All' ? params.customer : undefined,
                    customer_id: params?.customer_id,
                    month: params?.month || undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingUninvoicedLoads: () => client
                .get<{
                loads: FinancialUninvoicedLoad[];
            }>('/api/financials/accounting/invoices/uninvoiced-loads')
                .then((r) => r.data),
            accountingCreateInvoice: (payload: FinancialInvoiceCreatePayload) => client
                .post<FinancialInvoiceCreateResult>('/api/financials/accounting/invoices', payload)
                .then((r) => r.data),
            accountingUpdateInvoice: (invoiceId: number, payload: FinancialInvoiceUpdatePayload) => client
                .put<FinancialInvoiceUpdateResult>(`/api/financials/accounting/invoices/${invoiceId}`, payload)
                .then((r) => r.data),
            factorInvoiceBatch: (payload: FinancialFactorBatchPayload) => client
                .post<FinancialFactorBatchResult>('/api/financials/invoices/factor-batch', payload)
                .then((r) => r.data),
            accountingBills: (params?: {
                search?: string;
                status?: string;
                page?: number;
                limit?: number;
            }) => client
                .get<FinancialBillsPage>('/api/financials/accounting/bills', {
                params: {
                    search: params?.search?.trim() || undefined,
                    status: params?.status && params.status !== 'All' ? params.status : undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingCreateBill: (payload: FinancialBillCreatePayload) => client
                .post<FinancialBillCreateResult>('/api/financials/accounting/bills', payload)
                .then((r) => r.data),
            accountingPayBill: (billId: number, paymentAmount?: number) => client
                .post<FinancialBillPayResult>(`/api/financials/accounting/bills/${billId}/pay`, {
                payment_amount: paymentAmount ?? undefined,
            })
                .then((r) => r.data),
            accountingPayments: (params?: {
                search?: string;
                page?: number;
                limit?: number;
            }) => client
                .get<FinancialPaymentsPage>('/api/financials/accounting/payments', {
                params: {
                    search: params?.search?.trim() || undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingChartOfAccounts: () => client
                .get<ChartOfAccountsResponse>('/api/financials/accounting/chart-of-accounts')
                .then((r) => r.data),
            accountingJournalEntries: (params?: {
                search?: string;
                start_date?: string;
                end_date?: string;
                page?: number;
                limit?: number;
            }) => client
                .get<FinancialJournalEntriesPage>('/api/financials/accounting/journal-entries', {
                params: {
                    search: params?.search?.trim() || undefined,
                    start_date: params?.start_date || undefined,
                    end_date: params?.end_date || undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingCreateJournalEntry: (payload: FinancialJournalEntryCreatePayload) => client
                .post<FinancialJournalEntryCreateResult>('/api/financials/accounting/journal-entries', payload)
                .then((r) => r.data),
            accountingLedgerExport: (params: {
                tab: 'invoices' | 'payments' | 'bills' | 'journal_entries';
                search?: string;
                status?: string;
                customer?: string;
                month?: string;
                start_date?: string;
                end_date?: string;
            }) => {
                const trimmedSearch = params.search?.trim();
                const normalizedStatus = params.status && params.status !== 'All' ? params.status : undefined;
                const normalizedCustomer = params.customer && params.customer !== 'All' ? params.customer : undefined;
                const trimmedStart = params.start_date?.trim();
                const trimmedEnd = params.end_date?.trim();
                const trimmedMonth = params.month?.trim();
                return client
                    .get<Blob>('/api/financials/accounting/export', {
                    params: {
                        tab: params.tab,
                        search: trimmedSearch || undefined,
                        status: normalizedStatus,
                        customer: normalizedCustomer,
                        month: trimmedMonth || undefined,
                        start_date: trimmedStart || undefined,
                        end_date: trimmedEnd || undefined,
                    },
                    responseType: 'blob',
                })
                    .then((response) => {
                    const disposition = response.headers['content-disposition'];
                    const filenameMatch = typeof disposition === 'string'
                        ? /filename="?([^";\n]+)"?/i.exec(disposition)
                        : null;
                    return {
                        blob: response.data,
                        filename: filenameMatch?.[1] ?? `${params.tab}.csv`,
                    };
                });
            },
            accountingPeriodClosingHealth: () => client
                .get<FinancialPeriodClosingHealth>('/api/financials/accounting/period-closing/health')
                .then((r) => r.data),
            accountingClosePeriod: (payload: {
                year: number;
                month: number;
            }) => client
                .post<FinancialPeriodLockResult>('/api/financials/accounting/period-locks', payload)
                .then((r) => r.data),
            accountingTaxSummary: (params?: {
                year?: number;
                month?: number;
                trailing_months?: number;
            }) => client
                .get<FinancialTaxSummary>('/api/financials/accounting/tax-summary', {
                params: {
                    year: params?.year ?? undefined,
                    month: params?.month ?? undefined,
                    trailing_months: params?.trailing_months ?? 3,
                },
            })
                .then((r) => r.data),
            accountingTaxSummaryExport: (params?: {
                report_type?: 'tax' | 'trial_balance';
                year?: number;
                month?: number;
                trailing_months?: number;
            }) => client
                .get<Blob>('/api/financials/accounting/tax-summary/export', {
                params: {
                    report_type: params?.report_type ?? 'tax',
                    year: params?.year ?? undefined,
                    month: params?.month ?? undefined,
                    trailing_months: params?.trailing_months ?? 3,
                },
                responseType: 'blob',
            })
                .then((r) => r.data),
            accountingAgingSummary: () => client
                .get<FinancialAgingSummary>('/api/financials/accounting/aging-summary')
                .then((r) => r.data),
            accountingDriverSettlements: (params?: {
                driver_id?: number | null;
                page?: number;
                limit?: number;
            }) => client
                .get<DriverSettlementsPage>('/api/financials/accounting/driver-settlements', {
                params: {
                    driver_id: params?.driver_id ?? undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingPayroll: (params?: {
                recipient_type?: PayrollRecipientType | 'ALL' | null;
                recipient_id?: number | null;
                page?: number;
                limit?: number;
            }) => client
                .get<PayrollPage>('/api/financials/accounting/payroll', {
                params: {
                    recipient_type: params?.recipient_type && params.recipient_type !== 'ALL'
                        ? params.recipient_type
                        : undefined,
                    recipient_id: params?.recipient_id ?? undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 10,
                },
            })
                .then((r) => r.data),
            accountingCreateStaffPayrollBatch: (payload: StaffPayrollBatchInput) => client
                .post<PayrollLedgerRow>('/api/financials/accounting/payroll/staff-batches', payload)
                .then((r) => r.data),
            accountingCreateDispatcherPayrollBatch: (payload: DispatcherPayrollBatchInput) => client
                .post<PayrollLedgerRow>('/api/financials/accounting/payroll/dispatcher-batches', payload)
                .then((r) => r.data),
            compileDriverSettlement: (payload: DriverSettlementCompileInput) => client
                .post<DriverSettlementCompileResult>('/api/financials/driver-settlements/compile', payload)
                .then((r) => r.data),
            accountingDispatcherUnbatched: () => client
                .get<DispatcherUnbatchedResponse>('/api/financials/accounting/payroll/dispatcher-unbatched')
                .then((r) => r.data),
            accountingFinalizePayroll: (recordId: number, recipientType: PayrollRecipientType | string) => client
                .post<PayrollFinalizeResult>(`/api/financials/accounting/payroll/${recordId}/finalize`, null, { params: { recipient_type: recipientType } })
                .then((r) => r.data),
            accountingFinalizeDriverSettlement: (settlementId: number) => client
                .post<DriverSettlementFinalizeResult>(`/api/financials/accounting/driver-settlements/${settlementId}/finalize`)
                .then((r) => r.data),
            accountingRecentTransactions: (limit = 8) => client
                .get<FinancialRecentTransactionsFeed>('/api/financials/accounting/recent-transactions', {
                params: { limit },
            })
                .then((r) => r.data),
            accountingCashFlow: () => client
                .get<FinancialCashFlow>('/api/financials/accounting/cash-flow')
                .then((r) => r.data),
            accountingBankConnect: (payload: BankConnectRequest) => client
                .post<BankConnectResponse>('/api/financials/accounting/bank/connect', payload)
                .then((r) => r.data),
            accountingBankTransactions: () => client
                .get<BankTransactionsResponse>('/api/financials/accounting/bank/transactions')
                .then((r) => r.data),
            accountingBankAutoMatch: () => client
                .post<BankAutoMatchResponse>('/api/financials/accounting/bank/auto-match')
                .then((r) => r.data),
            accountingBankApproveMatch: (payload: BankApproveStagedMatchRequest) => client
                .post<BankMatchResponse>('/api/financials/accounting/bank/match/approve', payload)
                .then((r) => r.data),
            accountingBankMatch: (payload: BankMatchRequest) => client
                .post<BankMatchResponse>('/api/financials/accounting/bank/match', payload)
                .then((r) => r.data),
            fuelIftaSummary: (params?: FuelIftaSummaryQuery) => client
                .get<FuelIftaFinancialSummary>('/api/financials/fuel-ifta/summary', {
                params: {
                    quarter: params?.quarter || undefined,
                    date_range: params?.date_range || undefined,
                },
            })
                .then((r) => r.data),
            fuelIftaTransactions: (params?: FuelIftaTransactionsQuery) => client
                .get<FuelIftaTransactionsPage>('/api/financials/fuel-ifta/transactions', {
                params: {
                    vehicle_id: params?.vehicle_id ?? undefined,
                    date_range: params?.date_range || undefined,
                    quarter: params?.quarter || undefined,
                    search: params?.search?.trim() || undefined,
                    fuel_type: params?.fuel_type || undefined,
                    type: params?.type || undefined,
                    has_receipt: params?.has_receipt ?? undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 7,
                },
            })
                .then((r) => r.data),
            fuelTransactions: (params?: FuelIftaTransactionsQuery) => client
                .get<FuelIftaTransactionsPage>('/api/financials/fuel/transactions', {
                params: {
                    vehicle_id: params?.vehicle_id ?? undefined,
                    date_range: params?.date_range || undefined,
                    quarter: params?.quarter || undefined,
                    search: params?.search?.trim() || undefined,
                    fuel_type: params?.fuel_type || undefined,
                    type: params?.type || undefined,
                    has_receipt: params?.has_receipt ?? undefined,
                    page: params?.page ?? 1,
                    limit: params?.limit ?? 7,
                },
            })
                .then((r) => r.data),
            fuelCreateTransaction: (payload: FuelTransactionCreatePayload) => client
                .post<FuelIftaTransactionRow>('/api/financials/fuel/transactions', payload)
                .then((r) => r.data),
            fuelCreateManualTransaction: (formData: FormData) => client
                .post<FuelIftaTransactionRow>('/api/financials/fuel/transactions/manual', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
                .then((r) => r.data),
            fuelImportCardData: (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                return client
                    .post<FuelCardImportResult>('/api/financials/fuel/import-card-data', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                    .then((r) => r.data);
            },
            fuelIftaTransactionsExport: (params?: Omit<FuelIftaTransactionsQuery, 'page' | 'limit'>) => client
                .get<Blob>('/api/financials/fuel-ifta/transactions/export', {
                params: {
                    vehicle_id: params?.vehicle_id ?? undefined,
                    date_range: params?.date_range || undefined,
                    quarter: params?.quarter || undefined,
                    search: params?.search?.trim() || undefined,
                    fuel_type: params?.fuel_type || undefined,
                    type: params?.type || undefined,
                    has_receipt: params?.has_receipt ?? undefined,
                },
                responseType: 'blob',
            })
                .then((r) => r.data),
            fuelIftaFilingsHistory: () => client
                .get<FuelIftaFilingsHistory>('/api/financials/fuel-ifta/filings-history')
                .then((r) => r.data),
            iftaQuarterlySummary: (params: {
                year: number;
                quarter: number;
            }) => client
                .get<IftaQuarterlySummary>('/api/financials/ifta/quarterly-summary', { params })
                .then((r) => r.data),
            iftaLockQuarter: (payload: {
                year: number;
                quarter: number;
            }) => client
                .post<IftaQuarterlySummary>('/api/financials/ifta/lock-quarter', payload)
                .then((r) => r.data),
        },
        search: {
            global: (q: string) => client
                .get<GlobalSearchResponse>('/api/search', { params: { q } })
                .then((r) => r.data),
        },
        mobile: {
            devices: () => client.get<MobileDevicesResponse>('/api/mobile/devices').then((r) => r.data),
            createPairingCode: (driverId: number) => client
                .post<MobilePairingCodeResult>(`/api/mobile/devices/${driverId}/pairing-code`)
                .then((r) => r.data),
            telemetryTrails: (params?: {
                load_id?: number;
                limit?: number;
            }) => client
                .get<TelemetryTrailsResponse>('/api/mobile/telemetry/trails', {
                params: {
                    load_id: params?.load_id ?? undefined,
                    limit: params?.limit ?? 200,
                },
            })
                .then((r) => r.data),
        },
        assets: {
            truckDocuments: (truckId: number) => client
                .get<DriverDocumentRecord[]>(`/api/assets/trucks/${truckId}/documents`)
                .then((r) => r.data),
            trailerDocuments: (trailerId: number) => client
                .get<DriverDocumentRecord[]>(`/api/assets/trailers/${trailerId}/documents`)
                .then((r) => r.data),
            listDocuments: (entityType: 'TRUCK' | 'TRAILER', assetId: number) => {
                if (!Number.isFinite(assetId) || assetId <= 0) {
                    return Promise.reject(new Error('Invalid asset id'));
                }
                const segment = entityType === 'TRAILER' ? 'trailers' : 'trucks';
                return client
                    .get<DriverDocumentRecord[]>(`/api/assets/${segment}/${assetId}/documents`)
                    .then((r) => r.data);
            },
            uploadTruckDocument: (truckId: number, file: File, documentType: string) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', documentType);
                return client
                    .post<DriverDocumentRecord>(`/api/assets/trucks/${truckId}/documents`, formData)
                    .then((r) => r.data);
            },
            uploadTrailerDocument: (trailerId: number, file: File, documentType: string) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', documentType);
                return client
                    .post<DriverDocumentRecord>(`/api/assets/trailers/${trailerId}/documents`, formData)
                    .then((r) => r.data);
            },
            uploadDocument: (entityType: 'TRUCK' | 'TRAILER', assetId: number, file: File, documentType: string) => {
                if (!Number.isFinite(assetId) || assetId <= 0) {
                    return Promise.reject(new Error('Invalid asset id'));
                }
                const formData = new FormData();
                formData.append('file', file);
                formData.append('document_type', documentType);
                const segment = entityType === 'TRAILER' ? 'trailers' : 'trucks';
                return client
                    .post<DriverDocumentRecord>(`/api/assets/${segment}/${assetId}/documents`, formData)
                    .then((r) => r.data);
            },
            customFolders: (entityType: 'TRUCK' | 'TRAILER' | 'DRIVER', scope: EntityCustomFolderScope) => client
                .get<EntityCustomFolderRecord[]>('/api/assets/custom-folders', {
                params: {
                    entity_type: entityType,
                    truck_id: scope.truckId,
                    trailer_id: scope.trailerId,
                    driver_id: scope.driverId,
                },
            })
                .then((r) => r.data),
            createCustomFolder: (entityType: 'TRUCK' | 'TRAILER' | 'DRIVER', folderName: string, scope: EntityCustomFolderScope) => client
                .post<EntityCustomFolderRecord>('/api/assets/custom-folders', {
                entity_type: entityType,
                folder_name: folderName,
                truck_id: scope.truckId ?? null,
                trailer_id: scope.trailerId ?? null,
                driver_id: scope.driverId ?? null,
            })
                .then((r) => r.data),
            deleteCustomFolder: (folderId: number) => client.delete(`/api/assets/custom-folders/${folderId}`).then(() => undefined),
            deleteDocument: (documentId: number) => client.delete(`/api/assets/documents/${documentId}`).then(() => undefined),
        },
    };
}
export type TmsApi = ReturnType<typeof createTmsApi>;
