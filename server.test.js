const {
  computeStockMetrics,
  buildSystemPrompt,
  buildUserPrompt,
} = require('./helpers');

describe('computeStockMetrics', () => {
  const bars = [
    { t: new Date('2024-01-01').getTime(), o: 100, h: 105, l: 98, c: 102, v: 1000000 },
    { t: new Date('2024-01-02').getTime(), o: 102, h: 108, l: 101, c: 107, v: 1200000 },
    { t: new Date('2024-01-03').getTime(), o: 107, h: 110, l: 105, c: 106, v: 900000 },
    { t: new Date('2024-01-04').getTime(), o: 106, h: 109, l: 103, c: 104, v: 1100000 },
    { t: new Date('2024-01-05').getTime(), o: 104, h: 107, l: 100, c: 103, v: 950000 },
    { t: new Date('2024-01-08').getTime(), o: 103, h: 106, l: 100, c: 105, v: 1050000 },
    { t: new Date('2024-01-09').getTime(), o: 105, h: 112, l: 104, c: 111, v: 1300000 },
    { t: new Date('2024-01-10').getTime(), o: 111, h: 115, l: 109, c: 114, v: 1400000 },
    { t: new Date('2024-01-11').getTime(), o: 114, h: 116, l: 111, c: 112, v: 1250000 },
    { t: new Date('2024-01-12').getTime(), o: 112, h: 118, l: 110, c: 117, v: 1350000 },
  ];

  it('returns null for empty input', () => {
    expect(computeStockMetrics([])).toBeNull();
    expect(computeStockMetrics(null)).toBeNull();
  });

  it('returns correct currentPrice', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.currentPrice).toBe(117);
  });

  it('calculates priceChangePercent correctly', () => {
    const metrics = computeStockMetrics(bars);
    // (117 - 102) / 102 * 100 ≈ 14.71%
    expect(metrics.priceChangePercent).toBeCloseTo(14.71, 1);
  });

  it('identifies bullish trend for >2% gain', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.trend).toBe('bullish');
  });

  it('identifies bearish trend for >2% loss', () => {
    const bearishBars = bars.map((b, i) => ({ ...b, c: 100 - i }));
    const metrics = computeStockMetrics(bearishBars);
    expect(metrics.trend).toBe('bearish');
  });

  it('identifies sideways trend for small changes', () => {
    const flatBars = bars.map(b => ({ ...b, c: 100 }));
    const metrics = computeStockMetrics(flatBars);
    expect(metrics.trend).toBe('sideways');
  });

  it('returns positive volatility', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.volatilityPercent).toBeGreaterThan(0);
  });

  it('computes SMA5 and SMA20', () => {
    const metrics = computeStockMetrics(bars);
    // SMA5 = average of last 5 closes: 105, 111, 114, 112, 117 = 559/5 = 111.8
    expect(metrics.sma5).toBeCloseTo(111.8, 1);
    expect(metrics.sma20).toBeGreaterThan(0);
  });

  it('computes meanPrice and stdDev', () => {
    const metrics = computeStockMetrics(bars);
    // mean of closes: (102+107+106+104+103+105+111+114+112+117)/10 = 1081/10 = 108.1
    expect(metrics.meanPrice).toBeCloseTo(108.1, 1);
    expect(metrics.stdDev).toBeGreaterThan(0);
  });

  it('sets suggestedBuyPrice below meanPrice and suggestedSellPrice above meanPrice', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.suggestedBuyPrice).toBeLessThan(metrics.meanPrice);
    expect(metrics.suggestedSellPrice).toBeGreaterThan(metrics.meanPrice);
  });

  it('sets suggestedBuyPrice = meanPrice - stdDev and suggestedSellPrice = meanPrice + stdDev', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.suggestedBuyPrice).toBeCloseTo(metrics.meanPrice - metrics.stdDev, 1);
    expect(metrics.suggestedSellPrice).toBeCloseTo(metrics.meanPrice + metrics.stdDev, 1);
  });

  it('computes Bollinger Bands around SMA20', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.bollingerUpper).toBeGreaterThan(metrics.sma20);
    expect(metrics.bollingerLower).toBeLessThan(metrics.sma20);
  });

  it('returns correct dataPoints count', () => {
    const metrics = computeStockMetrics(bars);
    expect(metrics.dataPoints).toBe(bars.length);
  });
});

describe('buildSystemPrompt', () => {
  it('includes risk tolerance in the prompt', () => {
    const prompt = buildSystemPrompt({ riskTolerance: 'high' });
    expect(prompt).toContain('high');
  });

  it('includes investment horizon in the prompt', () => {
    const prompt = buildSystemPrompt({ investmentHorizon: 'long' });
    expect(prompt).toContain('long');
  });

  it('includes goals in the prompt', () => {
    const prompt = buildSystemPrompt({ goals: 'income' });
    expect(prompt).toContain('income');
  });

  it('includes experience level in the prompt', () => {
    const prompt = buildSystemPrompt({ experience: 'beginner' });
    expect(prompt).toContain('beginner');
  });

  it('includes investmentAmount when provided', () => {
    const prompt = buildSystemPrompt({ investmentAmount: 50000 });
    expect(prompt).toContain('50,000');
  });

  it('uses defaults when profile fields are omitted', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('medium');
    expect(prompt).toContain('balanced');
  });
});

describe('buildUserPrompt', () => {
  const metrics = {
    AAPL: {
      currentPrice: 150,
      priceChangePercent: 5.5,
      trend: 'bullish',
      volatilityPercent: 1.2,
      momentumPercent: 2.1,
      avgVolume: 80000000,
      sma5: 148.5,
      sma20: 145.0,
      meanPrice: 146.0,
      stdDev: 3.5,
      suggestedBuyPrice: 142.5,
      suggestedSellPrice: 149.5,
      bollingerUpper: 152.0,
      bollingerLower: 138.0,
      period: '2024-01-01 to 2024-01-31',
    },
    TSLA: null,
  };
  const profile = { riskTolerance: 'medium', investmentHorizon: 'long', goals: 'growth' };

  it('includes stock symbols', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('AAPL');
    expect(prompt).toContain('TSLA');
  });

  it('handles missing stock data gracefully', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('No market data available');
  });

  it('includes price metrics for available stocks', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('$150');
    expect(prompt).toContain('5.5%');
    expect(prompt).toContain('bullish');
  });

  it('includes profile details in the prompt', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('medium');
    expect(prompt).toContain('long');
    expect(prompt).toContain('growth');
  });

  it('requests buy/hold/sell recommendations', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('buy / hold / sell');
  });

  it('includes statistical buy/sell zones and Bollinger Bands in the prompt', () => {
    const prompt = buildUserPrompt(metrics, profile);
    expect(prompt).toContain('Statistical Buy Zone');
    expect(prompt).toContain('Statistical Sell Zone');
    expect(prompt).toContain('Bollinger Upper Band');
    expect(prompt).toContain('Bollinger Lower Band');
    expect(prompt).toContain('Mean Close Price');
    expect(prompt).toContain('Price Std Dev');
  });
});
