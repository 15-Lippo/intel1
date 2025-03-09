export async function getTopCryptos() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=500&page=1&sparkline=false');
        const cryptos = await response.json();
        return cryptos
            .filter(crypto => crypto.market_cap > 50_000_000) 
            .map(crypto => ({
                name: crypto.name,
                symbol: crypto.symbol.toUpperCase(),
                currentPrice: crypto.current_price,
                marketCap: crypto.market_cap,
                priceChangePercentage24h: crypto.price_change_percentage_24h,
                rank: crypto.market_cap_rank
            }));
    } catch (error) {
        console.error('Error fetching top cryptocurrencies:', error);
        return [];
    }
}

export async function getCryptoSignals() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false');
        const cryptos = await response.json();

        return cryptos
            .filter(crypto => crypto.market_cap > 10_000_000) 
            .map(crypto => {
                const { signalType, confidence } = enhancedSignalAnalysis(crypto);
                const entryPrice = crypto.current_price;
                const targetPrice = calculateTargetPrice(crypto, signalType);
                const stopLoss = calculateStopLoss(crypto, signalType);

                return {
                    pair: `${crypto.symbol.toUpperCase()}/USDT`,
                    name: crypto.name,
                    signalType,
                    entryPrice: entryPrice.toFixed(4),
                    targetPrice: targetPrice.toFixed(4),
                    stopLoss: stopLoss.toFixed(4),
                    potentialGain: ((targetPrice - entryPrice) / entryPrice * 100).toFixed(2),
                    riskReward: calculateRiskReward(entryPrice, targetPrice, stopLoss),
                    confidence: confidence,
                    priceChange24h: crypto.price_change_percentage_24h.toFixed(2)
                };
            })
            .filter(signal => 
                signal.signalType !== 'NEUTRAL' && 
                Math.abs(parseFloat(signal.potentialGain)) > 3 
            )
            .sort((a, b) => Math.abs(parseFloat(b.potentialGain)) - Math.abs(parseFloat(a.potentialGain)))
            .slice(0, 50); 
    } catch (error) {
        console.error('Error generating crypto signals:', error);
        return [];
    }
}

function enhancedSignalAnalysis(crypto) {
    const { 
        price_change_percentage_24h: priceChange, 
        total_volume: volume,
        market_cap: marketCap 
    } = crypto;
    
    let signalType = 'NEUTRAL';
    let confidence = 0;
    
    const volumeIndicator = volume / marketCap;
    const volatilityFactor = Math.abs(priceChange);

    if (priceChange > 7 && volumeIndicator > 0.001) {
        signalType = 'BUY';
        confidence = Math.min(volatilityFactor * 3, 95);
    } else if (priceChange < -7 && volumeIndicator > 0.001) {
        signalType = 'SELL';
        confidence = Math.min(volatilityFactor * 3, 95);
    }

    return { 
        signalType, 
        confidence: Math.floor(confidence)
    };
}

function calculateTargetPrice(crypto, signalType) {
    const currentPrice = crypto.current_price;
    const volatility = Math.abs(crypto.price_change_percentage_24h);
    
    return signalType === 'BUY' 
        ? currentPrice * (1 + (0.08 + volatility/100)) 
        : signalType === 'SELL' 
            ? currentPrice * (1 - (0.08 + volatility/100)) 
            : currentPrice;
}

function calculateStopLoss(crypto, signalType) {
    const currentPrice = crypto.current_price;
    const volatility = Math.abs(crypto.price_change_percentage_24h);
    
    return signalType === 'BUY' 
        ? currentPrice * (1 - (0.05 + volatility/200)) 
        : signalType === 'SELL' 
            ? currentPrice * (1 + (0.05 + volatility/200)) 
            : currentPrice;
}

function calculateRiskReward(entry, target, stopLoss) {
    const potentialProfit = Math.abs(target - entry);
    const potentialLoss = Math.abs(entry - stopLoss);
    return potentialLoss > 0 ? `1:${(potentialProfit / potentialLoss).toFixed(2)}` : '1:1';
}

export async function getCryptoHistoricalData(symbol, days = 30) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/market_chart?vs_currency=usd&days=${days}`);
        const historicalData = await response.json();
        
        const labels = historicalData.prices.map((_, index) => index);
        const prices = historicalData.prices.map(price => price[1]);
        
        return {
            labels: labels,
            datasets: [{
                label: `${symbol.toUpperCase()} Price`,
                data: prices,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        };
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        return null;
    }
}
