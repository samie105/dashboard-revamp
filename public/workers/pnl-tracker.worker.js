/**
 * PnL Tracking Web Worker
 * Polls price data and calculates unrealized PnL for open trades
 * Uses BigNumber for precision
 */

// Import BigNumber (we'll load it from CDN)
importScripts('https://cdn.jsdelivr.net/npm/bignumber.js@9.1.2/bignumber.min.js');

// Configure BigNumber
BigNumber.config({
  DECIMAL_PLACES: 18,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-18, 36]
});

let intervalId = null;
let currentTrade = null;
let isTracking = false;

// Token decimals mapping
const TOKEN_DECIMALS = {
  'ETH': 18,
  'USDT': 6,
  'USDC': 6,
  'SOL': 9,
  'BTC': 8,
  'WBTC': 8,
  'DAI': 18,
  'MATIC': 18,
  'ARB': 18
};

/**
 * Get token decimals
 */
function getDecimals(symbol) {
  return TOKEN_DECIMALS[symbol.toUpperCase()] || 18;
}

/**
 * Calculate unrealized PnL
 */
function calculatePnL(trade, currentPrice) {
  try {
    const entryPrice = new BigNumber(trade.entry_price);
    const amountIn = new BigNumber(trade.amount_in);
    const amountOutExpected = new BigNumber(trade.amount_out_expected);
    const currentPriceBN = new BigNumber(currentPrice);
    
    const tokenInDecimals = getDecimals(trade.token_in);
    const tokenOutDecimals = getDecimals(trade.token_out);
    
    // Normalize amounts to human-readable
    const amountInNormalized = amountIn.dividedBy(new BigNumber(10).pow(tokenInDecimals));
    const amountOutNormalized = amountOutExpected.dividedBy(new BigNumber(10).pow(tokenOutDecimals));
    
    let pnl, pnlPercentage;
    
    if (trade.side === 'BUY') {
      // BUY: pnl = (current_price * token_amount) - entry_value
      const currentValue = currentPriceBN.multipliedBy(amountOutNormalized);
      pnl = currentValue.minus(amountInNormalized);
      pnlPercentage = pnl.dividedBy(amountInNormalized).multipliedBy(100);
    } else {
      // SELL: pnl = entry_value - (current_price * token_amount)
      const currentValue = currentPriceBN.multipliedBy(amountOutNormalized);
      pnl = amountInNormalized.minus(currentValue);
      pnlPercentage = pnl.dividedBy(amountInNormalized).multipliedBy(100);
    }
    
    return {
      pnl: pnl.toFixed(6),
      pnlPercentage: pnlPercentage.toFixed(4),
      currentPrice: currentPriceBN.toFixed(6)
    };
  } catch (error) {
    console.error('[PnL Worker] Calculation error:', error);
    return null;
  }
}

/**
 * Fetch current price from backend
 */
async function fetchCurrentPrice(trade) {
  try {
    const tokenInDecimals = getDecimals(trade.token_in);
    const tokenOutDecimals = getDecimals(trade.token_out);
    
    // Use a small amount for price quote (1 unit)
    const quoteAmount = new BigNumber(10).pow(tokenInDecimals).toFixed(0);
    
    const response = await fetch('https://trading.watchup.site/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: trade.user_id,
        fromChain: trade.chain,
        toChain: trade.chain,
        tokenIn: trade.token_in,
        tokenOut: trade.token_out,
        amountIn: quoteAmount,
        slippage: 0.005
      })
    });
    
    if (!response.ok) {
      throw new Error(`Quote failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Calculate price: expectedOut / amountIn
    const expectedOut = new BigNumber(data.expectedOut || data.expectedOutput || '0');
    const amountIn = new BigNumber(quoteAmount);
    
    if (expectedOut.isZero()) {
      throw new Error('Invalid quote response');
    }
    
    // Normalize to human-readable price
    const price = expectedOut
      .dividedBy(new BigNumber(10).pow(tokenOutDecimals))
      .dividedBy(amountIn.dividedBy(new BigNumber(10).pow(tokenInDecimals)));
    
    return price.toFixed(18);
  } catch (error) {
    console.error('[PnL Worker] Price fetch error:', error);
    return null;
  }
}

/**
 * Track PnL for a trade
 */
async function trackPnL() {
  if (!currentTrade || !isTracking) {
    return;
  }
  
  try {
    // Fetch current price
    const currentPrice = await fetchCurrentPrice(currentTrade);
    
    if (!currentPrice) {
      postMessage({
        type: 'error',
        error: 'Failed to fetch current price'
      });
      return;
    }
    
    // Calculate PnL
    const pnlData = calculatePnL(currentTrade, currentPrice);
    
    if (!pnlData) {
      postMessage({
        type: 'error',
        error: 'Failed to calculate PnL'
      });
      return;
    }
    
    // Send update to main thread
    postMessage({
      type: 'pnl_update',
      tradeId: currentTrade.id,
      data: pnlData,
      timestamp: Date.now()
    });
  } catch (error) {
    postMessage({
      type: 'error',
      error: error.message
    });
  }
}

/**
 * Start tracking
 */
function startTracking(trade, pollInterval = 5000) {
  if (isTracking) {
    stopTracking();
  }
  
  currentTrade = trade;
  isTracking = true;
  
  // Initial calculation
  trackPnL();
  
  // Set up polling
  intervalId = setInterval(trackPnL, pollInterval);
  
  postMessage({
    type: 'tracking_started',
    tradeId: trade.id
  });
}

/**
 * Stop tracking
 */
function stopTracking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  isTracking = false;
  currentTrade = null;
  
  postMessage({
    type: 'tracking_stopped'
  });
}

/**
 * Message handler
 */
self.onmessage = function(e) {
  const { type, trade, pollInterval } = e.data;
  
  switch (type) {
    case 'start':
      if (!trade) {
        postMessage({
          type: 'error',
          error: 'Trade data required'
        });
        return;
      }
      startTracking(trade, pollInterval);
      break;
      
    case 'stop':
      stopTracking();
      break;
      
    case 'ping':
      postMessage({
        type: 'pong',
        isTracking,
        tradeId: currentTrade?.id || null
      });
      break;
      
    default:
      postMessage({
        type: 'error',
        error: `Unknown message type: ${type}`
      });
  }
};

// Handle errors
self.onerror = function(error) {
  postMessage({
    type: 'error',
    error: error.message
  });
};
