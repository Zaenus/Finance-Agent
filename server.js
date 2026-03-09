require('dotenv').config();
const express = require('express');
const { restClient } = require('@polygon.io/client-js');
const OpenAI = require('openai'); // Using OpenAI SDK, compatible with xAI

const app = express();
const port = 3000;

app.use(express.json());

// Initialize clients
const polygon = restClient(process.env.POLYGON_API_KEY);

const xaiClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// Helper function to get date strings for API (YYYY-MM-DD)
function getDateString(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

const today = getDateString(0);
const oneMonthAgo = getDateString(30);

// Endpoint: POST /analyze
// Body: { "stocks": ["AAPL", "TSLA"] }
// Returns: { "advice": "AI-generated advice" }
app.post('/analyze', async (req, res) => {
  const { stocks } = req.body;

  if (!stocks || !Array.isArray(stocks)) {
    return res.status(400).json({ error: 'Provide an array of stock symbols in "stocks"' });
  }

  let stockData = '';

  try {
    for (const stock of stocks) {
      // Fetch daily aggregates (bars) for the last month
      const aggs = await polygon.aggregates(stock, 1, 'day', oneMonthAgo, today);
      
      if (aggs.results) {
        const summaries = aggs.results.map(bar => ({
          date: new Date(bar.t).toISOString().split('T')[0],
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v
        }));
        
        stockData += `Stock: ${stock}\nData: ${JSON.stringify(summaries, null, 2)}\n\n`;
      } else {
        stockData += `No data found for ${stock}\n\n`;
      }
    }

    // Prepare prompt for AI
    const prompt = `Analyze the following stock performances over the last month and provide advice on market opportunities, including potential buys, sells, or holds based on trends, volatility, and overall market insights:\n\n${stockData}`;

    // Call xAI Grok API
    const response = await xaiClient.chat.completions.create({ // Note: Using chat.completions for compatibility; adjust if needed to responses.create
      model: 'grok-4-1-fast-reasoning',
      messages: [
        { role: 'system', content: 'You are a financial AI agent expert in stock analysis and market opportunities.' },
        { role: 'user', content: prompt }
      ],
    });

    const advice = response.choices[0].message.content;

    res.json({ advice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred during analysis' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});