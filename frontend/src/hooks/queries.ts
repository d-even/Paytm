import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ActionDecisionRequest, AgentAction, AgentRunReport, QueryRequest, TrustSettings } from '../mocks/types'

export const queryKeys = {
  insights: ['insights'] as const,
  actions: ['actions'] as const,
  trust: ['trust'] as const,
  outcomes: ['outcomes'] as const,
  cashflow: ['cashflow'] as const,
  campaigns: ['campaigns'] as const,
  regulars: ['regulars'] as const,
  merchant: ['merchant'] as const,
}

export const useInsights = () => useQuery({ queryKey: queryKeys.insights, queryFn: api.getInsights })
export const useActions = () => useQuery({ queryKey: queryKeys.actions, queryFn: api.getActions })
export const useTrustSettings = () => useQuery({ queryKey: queryKeys.trust, queryFn: api.getTrustSettings })
export const useOutcomes = () => useQuery({ queryKey: queryKeys.outcomes, queryFn: api.getOutcomes })
export const useCashflow = () => useQuery({ queryKey: queryKeys.cashflow, queryFn: api.getCashflow })
export const useCampaigns = () => useQuery({ queryKey: queryKeys.campaigns, queryFn: api.getCampaigns })
export const useRegulars = () => useQuery({ queryKey: queryKeys.regulars, queryFn: api.getRegulars })
export const useMerchant = () =>
  useQuery({ queryKey: queryKeys.merchant, queryFn: api.getMerchant, staleTime: Infinity })

/** Number of actions waiting on the merchant; drives the nav badge. */
export function usePendingCount() {
  const { data } = useActions()
  return data?.filter((a) => a.status === 'pending').length ?? 0
}

/**
 * Approve / reject / pause / resume / undo. The confirmed action is written
 * straight into the shared actions cache so every screen reflects it at once,
 * and dependent data (campaigns, briefing) is refetched.
 */
export function useActionDecision(onDecided?: (action: AgentAction, request: ActionDecisionRequest) => void) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActionDecisionRequest) => api.decideAction(payload),
    onSuccess: (updated, request) => {
      client.setQueryData<AgentAction[]>(queryKeys.actions, (current) =>
        current?.map((a) => (a.id === updated.id ? updated : a)),
      )
      void client.invalidateQueries({ queryKey: queryKeys.campaigns })
      void client.invalidateQueries({ queryKey: queryKeys.insights })
      // Hook-level, so it still runs if the card that asked has already left the screen.
      onDecided?.(updated, request)
    },
  })
}

/** The agent's thinking steps (Observe → Reason → Decide → Act → Learn) take at least this long on screen. */
export const AGENT_RUN_MIN_MS = 2_500

/**
 * "Run agent now". A new action from the run goes straight into the shared
 * actions cache, so the approval list and the nav badge update together.
 */
export function useRunAgent(onDone?: (report: AgentRunReport) => void) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const [report] = await Promise.all([api.runAgent(), new Promise((r) => setTimeout(r, AGENT_RUN_MIN_MS))])
      return report
    },
    onSuccess: (report) => {
      const added = report.newAction
      if (added) {
        client.setQueryData<AgentAction[]>(queryKeys.actions, (current) =>
          current ? [added, ...current.filter((a) => a.id !== added.id)] : current,
        )
      }
      onDone?.(report)
    },
  })
}

export function useUpdateTrustSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (settings: TrustSettings) => api.updateTrustSettings(settings),
    onMutate: async (settings) => {
      await client.cancelQueries({ queryKey: queryKeys.trust })
      const previous = client.getQueryData<TrustSettings>(queryKeys.trust)
      client.setQueryData(queryKeys.trust, settings)
      return { previous }
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) client.setQueryData(queryKeys.trust, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.trust }),
  })
}

export const useAskMitra = () => useMutation({ mutationFn: (payload: QueryRequest) => api.query(payload) })
