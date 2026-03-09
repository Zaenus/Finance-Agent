/**
 * Pure helper functions for stock analysis and prompt construction.
 * Extracted for testability and reuse.
 */

const VALID_RISK_TOLERANCES = ['low', 'medium', 'high'];
const VALID_HORIZONS = ['short', 'medium', 'long'];
const VALID_GOALS = ['growth', 'income', 'preservation', 'balanced'];
const VALID_EXPERIENCE = ['beginner', 'intermediate', 'expert'];

/**
 * Compute technical metrics from an array of OHLCV bars returned by Polygon.io.
 * @param {Array} bars - Array of bar objects with {t, o, h, l, c, v} properties.
 * @returns {object|null} Computed metrics or null if no bars provided.
 */
function computeStockMetrics(bars) {
  if (!bars || bars.length === 0) return null;

  const closes = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);

  const avgVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const priceChangePercent = ((lastClose - firstClose) / firstClose) * 100;

  // Volatility: standard deviation of daily percentage returns
  const dailyReturns = [];
  for (let i = 1; i < closes.length; i++) {
    dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  let volatilityPercent = 0;
  if (dailyReturns.length > 0) {
    const avgReturn = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / dailyReturns.length;
    volatilityPercent = Math.sqrt(variance) * 100;
  }

  // Momentum: average close of last 5 days vs previous 5 days
  const recentBars = bars.slice(-5);
  const prevBars = bars.slice(-10, -5);
  const recentAvg = recentBars.reduce((s, b) => s + b.c, 0) / recentBars.length;
  const prevAvg =
    prevBars.length > 0 ? prevBars.reduce((s, b) => s + b.c, 0) / prevBars.length : recentAvg;
  const momentumPercent = ((recentAvg - prevAvg) / prevAvg) * 100;

  // Simple moving averages
  const sma5Bars = closes.slice(-5);
  const sma5 = sma5Bars.reduce((s, v) => s + v, 0) / sma5Bars.length;
  const sma20Bars = closes.slice(-20);
  const sma20 = sma20Bars.reduce((s, v) => s + v, 0) / sma20Bars.length;

  const trend =
    priceChangePercent > 2 ? 'bullish' : priceChangePercent < -2 ? 'bearish' : 'sideways';

  return {
    currentPrice: lastClose,
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    trend,
    volatilityPercent: parseFloat(volatilityPercent.toFixed(2)),
    momentumPercent: parseFloat(momentumPercent.toFixed(2)),
    avgVolume: Math.round(avgVolume),
    sma5: parseFloat(sma5.toFixed(2)),
    sma20: parseFloat(sma20.toFixed(2)),
    dataPoints: bars.length,
    period: `${new Date(bars[0].t).toISOString().split('T')[0]} to ${new Date(bars[bars.length - 1].t).toISOString().split('T')[0]}`,
  };
}

/**
 * Build an AI system prompt personalised to the user's investment profile.
 * @param {object} profile - User investment profile.
 * @returns {string} System prompt string.
 */
function buildSystemPrompt(profile) {
  const riskDesc = {
    low: 'conservative, prioritising capital preservation with minimal risk',
    medium: 'balanced, seeking moderate growth with acceptable risk',
    high: 'aggressive, pursuing maximum growth and accepting higher risk',
  };
  const horizonDesc = {
    short: 'short-term (days to weeks)',
    medium: 'medium-term (months to 1 year)',
    long: 'long-term (1+ years)',
  };
  const goalDesc = {
    growth: 'capital growth and appreciation',
    income: 'regular dividend income and yield',
    preservation: 'capital preservation with inflation protection',
    balanced: 'balanced growth and income',
  };
  const experienceDesc = {
    beginner: 'a beginner investor who needs clear, simple explanations',
    intermediate: 'an intermediate investor familiar with basic financial concepts',
    expert: 'an expert investor who understands advanced financial analysis',
  };

  const risk = profile.riskTolerance || 'medium';
  const horizon = profile.investmentHorizon || 'medium';
  const goals = profile.goals || 'balanced';
  const experience = profile.experience || 'intermediate';

  return `You are an expert financial AI agent specialising in stock analysis and personalised investment advice.

User Investment Profile:
- Risk Tolerance: ${risk} — ${riskDesc[risk]}
- Investment Horizon: ${horizonDesc[horizon]}
- Investment Goals: ${goalDesc[goals]}
- Investor Experience: ${experienceDesc[experience]}${profile.investmentAmount ? `\n- Available Capital: $${Number(profile.investmentAmount).toLocaleString()}` : ''}

Tailor all advice specifically to this investor profile. Adjust your recommendations based on their risk tolerance, time horizon, and goals. For beginners, explain concepts clearly; for experts, you may use technical terminology.`;
}

/**
 * Build an AI user prompt containing computed stock metrics.
 * @param {object} stockMetrics - Map of symbol -> metrics (or null if unavailable).
 * @param {object} profile - User investment profile.
 * @returns {string} User prompt string.
 */
function buildUserPrompt(stockMetrics, profile) {
  let prompt = `Please analyse the following stocks and provide personalised investment advice based on my profile.\n\n`;

  for (const [symbol, metrics] of Object.entries(stockMetrics)) {
    prompt += `## ${symbol}\n`;
    if (metrics) {
      prompt += `- Current Price: $${metrics.currentPrice}\n`;
      prompt += `- 30-Day Price Change: ${metrics.priceChangePercent}%\n`;
      prompt += `- Trend: ${metrics.trend}\n`;
      prompt += `- Daily Volatility: ${metrics.volatilityPercent}%\n`;
      prompt += `- Short-term Momentum (5-day vs prior 5-day): ${metrics.momentumPercent}%\n`;
      prompt += `- Average Daily Volume: ${metrics.avgVolume.toLocaleString()}\n`;
      prompt += `- 5-Day SMA: $${metrics.sma5}\n`;
      prompt += `- 20-Day SMA: $${metrics.sma20}\n`;
      prompt += `- Analysis Period: ${metrics.period}\n\n`;
    } else {
      prompt += `- No market data available for this symbol.\n\n`;
    }
  }

  const risk = profile.riskTolerance || 'medium';
  const horizon = profile.investmentHorizon || 'medium';
  const goals = profile.goals || 'balanced';

  prompt += `Based on these metrics and my investment profile (${risk} risk tolerance, ${horizon}-term horizon, ${goals} goals), please provide:
1. A buy / hold / sell recommendation for each stock with reasoning.
2. Key risks and opportunities for each stock.
3. Suggested portfolio allocation across the analysed stocks.
4. Overall market context relevant to my profile.`;

  return prompt;
}

module.exports = {
  VALID_RISK_TOLERANCES,
  VALID_HORIZONS,
  VALID_GOALS,
  VALID_EXPERIENCE,
  computeStockMetrics,
  buildSystemPrompt,
  buildUserPrompt,
};
