import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { spendingData, monthsOfData, savingsRate, monthlySurplus, avgMonthlySpend, monthlyNet } = req.body;

  if (!spendingData) {
    return res.status(400).json({ error: 'Missing spending data' });
  }

  const categoryLines = Object.entries(spendingData)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, avg]) => `  - ${cat}: $${avg.toFixed(2)}/mo`)
    .join('\n');

  const prompt = `You are a personal finance advisor analyzing someone's real spending data. Be direct, specific, and actionable. Avoid generic advice.

Financial Summary:
- Monthly take-home: $${monthlyNet?.toFixed(0) || 'unknown'}
- Average monthly spend: $${avgMonthlySpend?.toFixed(0) || 'unknown'}
- Monthly surplus: $${monthlySurplus?.toFixed(0) || 'unknown'}
- Savings rate: ${savingsRate?.toFixed(1) || 'unknown'}%
- Months of data: ${monthsOfData}

Monthly spending by category:
${categoryLines}

Provide 3-5 specific, actionable insights. For each:
1. Call out the exact dollar amounts
2. Give a concrete recommendation (not vague)
3. Quantify the potential savings impact

Format your response as a JSON array of insight objects, each with:
- "title": short title (max 8 words)
- "amount": the dollar figure being discussed (e.g. "$420/mo")
- "severity": "warning" | "info" | "positive"
- "detail": 2-3 sentences of specific, actionable advice

Return only valid JSON, no markdown fences.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in environment variables' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    // Strip markdown fences if Claude added them anyway
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const insights = JSON.parse(text);
    res.status(200).json({ insights });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate insights' });
  }
}
