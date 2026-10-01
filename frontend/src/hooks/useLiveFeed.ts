import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { liveFeedUrl } from '../lib/api'
import type { Payment, ScannedCard, TodaySummary } from '../mocks/types'
import { useCounter } from '../store/counter'
import { useSession } from '../store/session'
import { queryKeys } from './queries'

/**
 * Live counter feed from the real backend (Server-Sent Events). Payments made
 * outside the app — a card tapped on the ESP32 reader, or the customer paying
 * from their phone after scanning the QR — land on the counter at once, the
 * agent's Soundbox lines are read out, and agent decisions refresh the lists.
 * With the in-browser mock there is nothing to listen to, so this does nothing.
 */
export function useLiveFeed() {
  const client = useQueryClient()
  const token = useSession((s) => s.token)

  useEffect(() => {
    const url = liveFeedUrl()
    if (!url) return
    const source = new EventSource(url)
    const parse = <T,>(event: MessageEvent) => JSON.parse(event.data as string) as T
    const refresh = (...keys: (keyof typeof queryKeys)[]) =>
      keys.forEach((key) => void client.invalidateQueries({ queryKey: queryKeys[key] }))

    // EventSource reconnects on its own if the server restarts.

    source.addEventListener('payment', (event) => {
      const { payment, today } = parse<{ payment: Payment; today: TodaySummary }>(event)
      useCounter.getState().receivePayment(payment, today)
      refresh('regulars', 'campaigns')
    })
    source.addEventListener('card', (event) => {
      useCounter.getState().setScannedCard(parse<ScannedCard>(event))
    })
    source.addEventListener('voice', (event) => {
      useCounter.getState().agentSays(parse<{ text: string }>(event).text)
    })
    source.addEventListener('action', () => refresh('actions', 'insights', 'campaigns', 'cashflow'))
    source.addEventListener('insight', () => refresh('insights'))
    source.addEventListener('whatsapp', () => refresh('campaigns'))

    return () => source.close()
  }, [client, token])
}

