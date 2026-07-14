import type { Account, Card, Subscription } from '@/types/database'

interface LoadResponse {
  ok: boolean
  json: () => Promise<unknown>
}

type Request = (url: string) => Promise<LoadResponse>

export interface SubscriptionsData {
  subscriptions: Subscription[]
  cards: Card[]
  accounts: Account[]
}

export async function loadSubscriptionsData(
  request: Request = fetch
): Promise<SubscriptionsData> {
  const responses = await Promise.all([
    request('/api/subscriptions'),
    request('/api/cards'),
    request('/api/accounts'),
  ])

  if (responses.some((response) => !response.ok)) {
    throw new Error('No pudimos cargar las suscripciones.')
  }

  const [subscriptions, cards, accounts] = await Promise.all(
    responses.map((response) => response.json())
  )

  return {
    subscriptions: Array.isArray(subscriptions) ? (subscriptions as Subscription[]) : [],
    cards: Array.isArray(cards) ? (cards as Card[]) : [],
    accounts: Array.isArray(accounts) ? (accounts as Account[]) : [],
  }
}
