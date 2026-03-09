# Finance Agent

An AI-powered financial advisor that provides personalised stock analysis and investment advice based on real market data and the user's investment profile.

## Features

- **Personalised advice** — tailored to your risk tolerance, investment horizon, goals, and experience level
- **Real market data** — 30-day OHLCV history fetched from [Polygon.io](https://polygon.io/)
- **Technical analysis** — automatically computes trend, volatility, momentum, and simple moving averages (SMA5, SMA20)
- **AI-driven insights** — powered by [Google Gemini](https://aistudio.google.com/) via the OpenAI-compatible SDK
- **Structured JSON responses** — includes AI advice, profile echo, per-stock metrics, and a timestamp

## Requirements

- Node.js ≥ 18
- [Polygon.io](https://polygon.io/) API key (free tier is sufficient)
- [Google AI Studio](https://aistudio.google.com/) API key

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your API keys
cp .env.example .env
# Edit .env and set POLYGON_API_KEY and GEMINI_API_KEY

# 3. Start the server
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Environment Variables

| Variable         | Required | Default  | Description                           |
|-----------------|----------|----------|---------------------------------------|
| `POLYGON_API_KEY` | ✅ Yes  |          | Polygon.io REST API key               |
| `GEMINI_API_KEY`  | ✅ Yes  |          | Google AI Studio API key              |
| `GEMINI_MODEL`    | No       | `gemini-2.5-flash` | Gemini model to use          |
| `PORT`           | No       | `3000`   | HTTP port the server listens on       |

## API

### `GET /health`

Liveness check.

**Response**
```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z" }
```

---

### `POST /analyze`

Analyse a list of stocks and return personalised investment advice.

**Request body**

```json
{
  "stocks": ["AAPL", "TSLA"],
  "profile": {
    "riskTolerance": "medium",
    "investmentHorizon": "long",
    "goals": "growth",
    "experience": "intermediate",
    "investmentAmount": 10000
  }
}
```

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `stocks` | ✅ Yes | Array of ticker symbols (max 10) | Stocks to analyse |
| `profile.riskTolerance` | No | `low` \| `medium` \| `high` | Your appetite for risk (default: `medium`) |
| `profile.investmentHorizon` | No | `short` \| `medium` \| `long` | Time horizon for investment (default: `medium`) |
| `profile.goals` | No | `growth` \| `income` \| `preservation` \| `balanced` | Primary investment goal (default: `balanced`) |
| `profile.experience` | No | `beginner` \| `intermediate` \| `expert` | Your experience level (default: `intermediate`) |
| `profile.investmentAmount` | No | Positive number (USD) | Optional capital to deploy |

**Response**

```json
{
  "advice": "Based on your profile... (AI-generated text)",
  "profile": {
    "riskTolerance": "medium",
    "investmentHorizon": "long",
    "goals": "growth",
    "experience": "intermediate",
    "investmentAmount": 10000
  },
  "stockSummary": {
    "AAPL": {
      "currentPrice": 189.5,
      "priceChangePercent": 3.42,
      "trend": "bullish",
      "volatilityPercent": 1.15,
      "momentumPercent": 2.30,
      "avgVolume": 55000000,
      "sma5": 188.2,
      "sma20": 185.0,
      "dataPoints": 21,
      "period": "2024-01-01 to 2024-01-31"
    }
  },
  "analyzedAt": "2024-01-31T12:00:00.000Z"
}
```

**Example (curl)**

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stocks": ["AAPL", "MSFT", "TSLA"],
    "profile": {
      "riskTolerance": "high",
      "investmentHorizon": "long",
      "goals": "growth",
      "experience": "intermediate",
      "investmentAmount": 25000
    }
  }'
```

## Running Tests

```bash
npm test
```

## Tech Stack

- [Express](https://expressjs.com/) — HTTP server
- [@polygon.io/client-js](https://github.com/polygon-io/client-js) — Market data
- [openai](https://github.com/openai/openai-node) — Google Gemini via OpenAI-compatible SDK
- [Jest](https://jestjs.io/) — Unit testing
