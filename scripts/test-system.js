console.log('🧪 System Test Starting...\n');

try {
    const testData = { price: 2500, symbol: 'ETH/USDC' };
    const json = JSON.stringify(testData);
    const parsed = JSON.parse(json);
    console.log('✅ JSON operations work');
} catch (error) {
    console.log('❌ JSON operations failed:', error.message);
}

try {
    const price1 = 2500;
    const price2 = 2520;
    const difference = Math.abs(price2 - price1);
    const percentage = (difference / price1) * 100;
    console.log(`✅ Math operations work (${percentage.toFixed(2)}% difference)`);
} catch (error) {
    console.log('❌ Math operations failed:', error.message);
}

console.log('\n🎉 System tests complete!');
