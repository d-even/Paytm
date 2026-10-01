import { MockApiError, mockRequest } from '../mocks/server'
import { useSession } from '../store/session'
import type {
  ActionDecisionRequest,
  AgentAction,
  AgentRunReport,
  Bill,
  BillRequest,
  Campaign,
  CashflowResponse,
  CreateBillRequest,
  InsightsResponse,
  Merchant,
  NamedCustomer,
  OtpRequest,
  OtpResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
  OutcomesResponse,
  PaymentResponse,
  QueryRequest,
  QueryResponse,
  RegularsResponse,
  TodaySummary,
  TrustSettings,
} from '../mocks/types'

/**
 * Typed API client. When VITE_API_BASE_URL is set (e.g. /api/app), requests go
 * to the real Vyapaar Mitra backend with the session token from OTP sign-in;
 * otherwise they are served by the in-browser mock.
 */

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || undefined

/** True when talking to the real backend (live payments, ESP32 card reader, phone QR). */
export const isLiveBackend = Boolean(baseUrl)

/** Server-Sent Events URL for live counter updates, or null with the mock. */
export function liveFeedUrl(): string | null {
  const token = useSession.getState().token
  return baseUrl && token ? `${baseUrl}/live?token=${encodeURIComponent(token)}` : null
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  if (!baseUrl) {
    try {
      return await mockRequest<T>(method, path, body)
    } catch (error) {
      if (error instanceof MockApiError) throw new ApiError(error.status, error.message)
      throw error
    }
  }

  const token = useSession.getState().token
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!response.ok) {
    const text = await response.text()
    let message = text
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text
    } catch {
      // Not JSON: keep the raw text.
    }
    // Expired or missing session: back to sign-in (the OTP routes report their own 401s).
    if (response.status === 401 && !path.startsWith('/auth/') && useSession.getState().signedIn) useSession.getState().signOut()
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as T
}

export const api = {
  getInsights: () => request<InsightsResponse>('GET', '/agent/insights'),
  getActions: () => request<AgentAction[]>('GET', '/agent/actions'),
  decideAction: (payload: ActionDecisionRequest) => request<AgentAction>('POST', '/agent/action/approve', payload),
  getTrustSettings: () => request<TrustSettings>('GET', '/agent/settings/trust'),
  updateTrustSettings: (settings: TrustSettings) => request<TrustSettings>('PUT', '/agent/settings/trust', settings),
  getOutcomes: () => request<OutcomesResponse>('GET', '/agent/outcomes'),
  getCashflow: () => request<CashflowResponse>('GET', '/agent/cashflow'),
  query: (payload: QueryRequest) => request<QueryResponse>('POST', '/agent/query', payload),
  getCampaigns: () => request<Campaign[]>('GET', '/agent/campaigns'),
  getRegulars: () => request<RegularsResponse>('GET', '/agent/regulars'),
  getMerchant: () => request<Merchant>('GET', '/merchant/profile'),
  sendOtp: (payload: OtpRequest) => request<OtpResponse>('POST', '/auth/otp', payload),
  verifyOtp: (payload: OtpVerifyRequest) => request<OtpVerifyResponse>('POST', '/auth/verify', payload),
  runAgent: () => request<AgentRunReport>('POST', '/agent/run'),
  getToday: () => request<TodaySummary>('GET', '/counter/today'),
  createBill: (payload: CreateBillRequest) => request<Bill>('POST', '/counter/bill', payload),
  tapCard: (payload: BillRequest) => request<PaymentResponse>('POST', '/counter/bill/tap', payload),
  cancelBill: (payload: BillRequest) => request<{ ok: boolean }>('POST', '/counter/bill/cancel', payload),
  // Real backend only: link a physical RFID card to a saved customer.
  getNamedCustomers: () => request<NamedCustomer[]>('GET', '/counter/customers'),
  linkCard: (payload: { rfidUid: string; customerId: string }) =>
    request<{ ok: boolean; label: string; visits: number }>('POST', '/counter/card/link', payload),
}
