interface InsightRequest {
  budget: number
  spent: number
  savings: number
  daysLeft: number
  dailyBudget: number
  expenses: { name: string; amount: number; date: string }[]
  savingsEntries: { name: string; amount: number; date: string }[]
}

export interface Insight {
  type: 'good' | 'warning' | 'danger'
  message: string
}

const inFlight = new Map<string, Promise<Insight[]>>()

export async function fetchInsights(data: InsightRequest, context: 'dashboard' | 'savings' = 'dashboard'): Promise<Insight[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) return []

  const cacheKey = `insights_${context}_${data.budget}_${data.spent}_${data.savings}_${data.daysLeft}_${data.dailyBudget}_${data.expenses.length}_${data.savingsEntries.length}`

  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.every((i: Insight) => i.type && i.message)) {
        return parsed as Insight[]
      }
    } catch {}
  }

  // Deduplicate in-flight requests for the same cacheKey
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey)!
  }

  const dashboardPrompt = `You are a strict personal finance coach helping someone spend less money. Analyze their data and give 3 specific, actionable tips to reduce spending. Be direct and use actual numbers.

Their situation:
- Monthly budget: BDT ${data.budget}
- Already spent: BDT ${data.spent} (${data.budget > 0 ? Math.round(data.spent / data.budget * 100) : 0}% of budget)
- Total savings: BDT ${data.savings}
- Days left this month: ${data.daysLeft}
- Max daily spend to stay on budget: BDT ${data.dailyBudget}

Their expenses this month:
${data.expenses.map((e) => `- ${e.name}: BDT ${e.amount}`).join('\n')}

Their savings this month:
${data.savingsEntries.map((s) => `- ${s.name}: BDT ${s.amount}`).join('\n')}

Return exactly 3 insights as a JSON array. Each object has "type" ("good"/"warning"/"danger") and "message" (one sentence, max 18 words, with actual BDT numbers).
- "good": reinforce positive behavior (e.g. "You saved BDT 5,000 by cutting dining out.")
- "warning": suggest improvement (e.g. "Grocery spending of BDT 8,000 is high — try meal planning.")
- "danger": flag risk (e.g. "You have only BDT 400/day left — skip non-essentials.")

Focus on what they can do RIGHT NOW to spend less. Be specific — reference their actual expense names and amounts. No markdown. Example:
[{"type":"warning","message":"Grocery trips costing BDT 3,200 this month — plan meals to cut BDT 800."},{"type":"danger","message":"Only BDT 400/day left for 12 days. Avoid dining out entirely."},{"type":"good","message":"Saved BDT 500 by skipping coffee runs. Keep it up!"}]`

  const savingsPrompt = `You are a savings optimization coach. Analyze this data and give 3 specific tips on how much more they could save and how to increase their savings.

Their situation:
- Monthly budget: BDT ${data.budget}
- Spent so far: BDT ${data.spent}
- Current savings: BDT ${data.savings}
- Days left this month: ${data.daysLeft}
- Available daily: BDT ${data.dailyBudget}

Their expenses this month:
${data.expenses.map((e) => `- ${e.name}: BDT ${e.amount}`).join('\n')}

Their savings this month:
${data.savingsEntries.map((s) => `- ${s.name}: BDT ${s.amount}`).join('\n')}

Return exactly 3 insights as a JSON array. Each object has "type" ("good"/"warning"/"danger") and "message" (one sentence, max 18 words, with actual BDT numbers).
Focus on:
- How much more they could save by cutting specific expenses
- Which expense to reduce first for maximum savings impact
- A realistic savings target for this month based on remaining budget
- Small daily changes that add up

No markdown. Example:
[{"type":"warning","message":"Skipping BDT 150 daily coffee could save BDT 3,000 this month."},{"type":"good","message":"Cutting dining out by BDT 1,200 would push savings to BDT 5,000."},{"type":"danger","message":"At this rate you'll save only BDT 800 — aim for BDT 3,000 by reducing groceries."}]`

  const prompt = context === 'savings' ? savingsPrompt : dashboardPrompt

  const attempt = async (retriesLeft: number, delay: number): Promise<Insight[]> => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 300,
        }),
      })

      if (res.status === 429 && retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, delay))
        return attempt(retriesLeft - 1, delay * 2)
      }

      if (!res.ok) {
        if (retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, delay))
          return attempt(retriesLeft - 1, delay * 2)
        }
        return []
      }

      const json = await res.json()
      const text = json.choices?.[0]?.message?.content || ''

      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed) && parsed.every((i) => i.type && i.message)) {
        const result = parsed.slice(0, 3)
        sessionStorage.setItem(cacheKey, JSON.stringify(result))
        return result
      }

      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, delay))
        return attempt(retriesLeft - 1, delay * 2)
      }
      return []
    } catch {
      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, delay))
        return attempt(retriesLeft - 1, delay * 2)
      }
      return []
    }
  }

  const promise = attempt(5, 3000)
  inFlight.set(cacheKey, promise)
  promise.finally(() => inFlight.delete(cacheKey))
  return promise
}
