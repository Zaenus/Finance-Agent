require('dotenv').config();
const express = require('express');
const { restClient } = require('@polygon.io/client-js');
const OpenAI = require('openai');
const {
  VALID_RISK_TOLERANCES,
  VALID_HORIZONS,
  VALID_GOALS,
  VALID_EXPERIENCE,
  computeStockMetrics,
  buildSystemPrompt,
  buildUserPrompt,
} = require('./helpers');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Initialize clients
const polygon = restClient(process.env.POLYGON_API_KEY);

const geminiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

// Helper: return a YYYY-MM-DD date string offset by daysAgo from today
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// GET /health — liveness check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /analyze
// Body: {
//   "stocks": ["AAPL", "TSLA"],
//   "profile": {
//     "riskTolerance": "medium",       // low | medium | high
//     "investmentHorizon": "long",     // short | medium | long
//     "goals": "growth",               // growth | income | preservation | balanced
//     "experience": "intermediate",    // beginner | intermediate | expert
//     "investmentAmount": 10000        // optional, in USD
//   }
// }
app.post('/analyze', async (req, res) => {
  const { stocks, profile = {} } = req.body;

  if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty array of stock symbols in "stocks".' });
  }

  if (stocks.length > 10) {
    return res.status(400).json({ error: 'A maximum of 10 stock symbols are allowed per request.' });
  }

  if (profile.riskTolerance && !VALID_RISK_TOLERANCES.includes(profile.riskTolerance)) {
    return res
      .status(400)
      .json({ error: `Invalid riskTolerance. Allowed values: ${VALID_RISK_TOLERANCES.join(', ')}.` });
  }
  if (profile.investmentHorizon && !VALID_HORIZONS.includes(profile.investmentHorizon)) {
    return res
      .status(400)
      .json({ error: `Invalid investmentHorizon. Allowed values: ${VALID_HORIZONS.join(', ')}.` });
  }
  if (profile.goals && !VALID_GOALS.includes(profile.goals)) {
    return res
      .status(400)
      .json({ error: `Invalid goals. Allowed values: ${VALID_GOALS.join(', ')}.` });
  }
  if (profile.experience && !VALID_EXPERIENCE.includes(profile.experience)) {
    return res
      .status(400)
      .json({ error: `Invalid experience. Allowed values: ${VALID_EXPERIENCE.join(', ')}.` });
  }
  if (
    profile.investmentAmount !== undefined &&
    (typeof profile.investmentAmount !== 'number' || profile.investmentAmount <= 0)
  ) {
    return res.status(400).json({ error: 'investmentAmount must be a positive number.' });
  }

  const today = getDateString(0);
  const oneMonthAgo = getDateString(30);
  const stockMetrics = {};

  try {
    for (const symbol of stocks) {
      const upperSymbol = symbol.toUpperCase().trim();
      const aggs = await polygon.stocks.aggregates(upperSymbol, 1, 'day', oneMonthAgo, today);

      stockMetrics[upperSymbol] =
        aggs.results && aggs.results.length > 0 ? computeStockMetrics(aggs.results) : null;
    }

    const systemPrompt = buildSystemPrompt(profile);
    const userPrompt = buildUserPrompt(stockMetrics, profile);

    const aiResponse = await geminiClient.chat.completions.create({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',  // <-- change here as needed
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const advice = aiResponse.choices[0].message.content;

    res.json({
      advice,
      profile: {
        riskTolerance: profile.riskTolerance || 'medium',
        investmentHorizon: profile.investmentHorizon || 'medium',
        goals: profile.goals || 'balanced',
        experience: profile.experience || 'intermediate',
        ...(profile.investmentAmount !== undefined && { investmentAmount: profile.investmentAmount }),
      },
      stockSummary: stockMetrics,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error during analysis:', error.message || error);
    if (error.status === 401 || error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Invalid API key configuration.' });
    }
    res.status(500).json({ error: 'An error occurred during analysis.' });
  }
});

app.listen(port, () => {
  console.log(`Finance Agent server running at http://localhost:${port}`);
});
