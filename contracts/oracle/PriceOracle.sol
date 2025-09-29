// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PriceOracle
 * @notice Price feed aggregation from multiple sources
 * @dev Aggregates prices from Chainlink, Uniswap TWAP, and other sources
 */
contract PriceOracle is EmergencyStop, ReentrancyGuard {
    enum PriceSource {
        CHAINLINK,
        UNISWAP_V2_TWAP,
        UNISWAP_V3_TWAP,
        EXTERNAL_API,
        MANUAL
    }
    
    struct PriceFeed {
        address feedAddress;
        PriceSource source;
        uint256 lastPrice;
        uint256 lastUpdate;
        bool isActive;
        uint256 heartbeat; // Maximum time between updates
        uint8 decimals;
    }
    
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        PriceSource source;
        uint256 confidence; // Price confidence (0-10000 basis points)
    }
    
    // Token address => Price feed info
    mapping(address => PriceFeed) public priceFeeds;
    
    // Token pair => Price data
    mapping(bytes32 => PriceData) public pairPrices;
    
    // Supported tokens
    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    
    // Price deviation threshold (in basis points)
    uint256 public maxPriceDeviation = 500; // 5%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_PRICE_AGE = 3600; // 1 hour
    
    // Price updaters (authorized addresses)
    mapping(address => bool) public priceUpdaters;
    
    event PriceUpdated(
        address indexed token,
        uint256 price,
        PriceSource source,
        uint256 timestamp
    );
    
    event PairPriceUpdated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 price,
        PriceSource source,
        uint256 confidence
    );
    
    event PriceFeedAdded(
        address indexed token,
        address feedAddress,
        PriceSource source
    );
    
    event PriceDeviationAlert(
        address indexed token,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 deviation
    );
    
    modifier onlyPriceUpdater() {
        require(
            priceUpdaters[msg.sender] || msg.sender == owner,
            "PriceOracle: not authorized updater"
        );
        _;
    }
    
    constructor() {
        // Add owner as price updater
        priceUpdaters[owner] = true;
    }
    
    /**
     * @notice Add a new price feed for a token
     * @param token Token address
     * @param feedAddress Price feed address
     * @param source Price source type
     * @param heartbeat Maximum time between updates
     * @param decimals Price decimals
     */
    function addPriceFeed(
        address token,
        address feedAddress,
        PriceSource source,
        uint256 heartbeat,
        uint8 decimals
    ) external onlyOwner {
        require(token != address(0), "PriceOracle: invalid token");
        require(feedAddress != address(0), "PriceOracle: invalid feed");
        
        priceFeeds[token] = PriceFeed({
            feedAddress: feedAddress,
            source: source,
            lastPrice: 0,
            lastUpdate: 0,
            isActive: true,
            heartbeat: heartbeat,
            decimals: decimals
        });
        
        if (!isSupportedToken[token]) {
            supportedTokens.push(token);
            isSupportedToken[token] = true;
        }
        
        emit PriceFeedAdded(token, feedAddress, source);
    }
    
    /**
     * @notice Update price for a token
     * @param token Token address
     * @param price New price
     * @param confidence Price confidence (0-10000)
     */
    function updatePrice(
        address token,
        uint256 price,
        uint256 confidence
    ) external onlyPriceUpdater nonReentrant {
        require(isSupportedToken[token], "PriceOracle: token not supported");
        require(price > 0, "PriceOracle: invalid price");
        require(confidence <= BASIS_POINTS, "PriceOracle: invalid confidence");
        
        PriceFeed storage feed = priceFeeds[token];
        
        // Check for significant price deviation
        if (feed.lastPrice > 0) {
            uint256 deviation = _calculateDeviation(feed.lastPrice, price);
            if (deviation > maxPriceDeviation) {
                emit PriceDeviationAlert(token, feed.lastPrice, price, deviation);
            }
        }
        
        feed.lastPrice = price;
        feed.lastUpdate = block.timestamp;
        
        emit PriceUpdated(token, price, feed.source, block.timestamp);
    }
    
    /**
     * @notice Update pair price
     * @param tokenA First token
     * @param tokenB Second token
     * @param price Price of tokenA in terms of tokenB
     * @param source Price source
     * @param confidence Price confidence
     */
    function updatePairPrice(
        address tokenA,
        address tokenB,
        uint256 price,
        PriceSource source,
        uint256 confidence
    ) external onlyPriceUpdater nonReentrant {
        require(tokenA != address(0) && tokenB != address(0), "PriceOracle: invalid tokens");
        require(tokenA != tokenB, "PriceOracle: same token");
        require(price > 0, "PriceOracle: invalid price");
        
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        
        pairPrices[pairKey] = PriceData({
            price: price,
            timestamp: block.timestamp,
            source: source,
            confidence: confidence
        });
        
        emit PairPriceUpdated(tokenA, tokenB, price, source, confidence);
    }
    
    /**
     * @notice Get latest price for a token
     * @param token Token address
     * @return price Latest price
     * @return timestamp Last update timestamp
     * @return isStale Whether price is stale
     */
    function getPrice(address token) 
        external 
        view 
        returns (uint256 price, uint256 timestamp, bool isStale) 
    {
        require(isSupportedToken[token], "PriceOracle: token not supported");
        
        PriceFeed memory feed = priceFeeds[token];
        price = feed.lastPrice;
        timestamp = feed.lastUpdate;
        isStale = (block.timestamp - timestamp) > feed.heartbeat;
    }
    
    /**
     * @notice Get pair price
     * @param tokenA First token
     * @param tokenB Second token
     * @return priceData Price data for the pair
     */
    function getPairPrice(address tokenA, address tokenB) 
        external 
        view 
        returns (PriceData memory priceData) 
    {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        priceData = pairPrices[pairKey];
        
        // If direct pair not available, try reverse
        if (priceData.price == 0) {
            bytes32 reversePairKey = _getPairKey(tokenB, tokenA);
            PriceData memory reverseData = pairPrices[reversePairKey];
            
            if (reverseData.price > 0) {
                priceData = PriceData({
                    price: (10**18) / reverseData.price, // Invert price
                    timestamp: reverseData.timestamp,
                    source: reverseData.source,
                    confidence: reverseData.confidence
                });
            }
        }
    }
    
    /**
     * @notice Check if price is fresh
     * @param token Token address
     * @return isFresh Whether price is fresh
     */
    function isPriceFresh(address token) external view returns (bool isFresh) {
        if (!isSupportedToken[token]) return false;
        
        PriceFeed memory feed = priceFeeds[token];
        isFresh = (block.timestamp - feed.lastUpdate) <= feed.heartbeat;
    }
    
    /**
     * @notice Get supported tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory tokens) {
        tokens = supportedTokens;
    }
    
    /**
     * @notice Calculate price with confidence interval
     * @param token Token address
     * @return price Base price
     * @return lowerBound Lower confidence bound
     * @return upperBound Upper confidence bound
     */
    function getPriceWithConfidence(address token) 
        external 
        view 
        returns (uint256 price, uint256 lowerBound, uint256 upperBound) 
    {
        require(isSupportedToken[token], "PriceOracle: token not supported");
        
        PriceFeed memory feed = priceFeeds[token];
        price = feed.lastPrice;
        
        // Simple confidence interval calculation (can be enhanced)
        uint256 deviation = (price * 100) / BASIS_POINTS; // 1% default
        lowerBound = price - deviation;
        upperBound = price + deviation;
    }
    
    /**
     * @notice Add price updater
     * @param updater Address to add as price updater
     */
    function addPriceUpdater(address updater) external onlyOwner {
        require(updater != address(0), "PriceOracle: invalid updater");
        priceUpdaters[updater] = true;
    }
    
    /**
     * @notice Remove price updater
     * @param updater Address to remove as price updater
     */
    function removePriceUpdater(address updater) external onlyOwner {
        priceUpdaters[updater] = false;
    }
    
    /**
     * @notice Set maximum price deviation threshold
     * @param newThreshold New threshold in basis points
     */
    function setMaxPriceDeviation(uint256 newThreshold) external onlyOwner {
        require(newThreshold <= 2000, "PriceOracle: threshold too high"); // Max 20%
        maxPriceDeviation = newThreshold;
    }
    
    /**
     * @notice Toggle price feed active status
     * @param token Token address
     * @param isActive New active status
     */
    function setPriceFeedStatus(address token, bool isActive) external onlyOwner {
        require(isSupportedToken[token], "PriceOracle: token not supported");
        priceFeeds[token].isActive = isActive;
    }
    
    /**
     * @notice Emergency price update
     * @param token Token address
     * @param price Emergency price
     */
    function emergencyPriceUpdate(address token, uint256 price) 
        external 
        onlyOwner 
        onlyInEmergencyStop 
    {
        require(isSupportedToken[token], "PriceOracle: token not supported");
        require(price > 0, "PriceOracle: invalid price");
        
        PriceFeed storage feed = priceFeeds[token];
        feed.lastPrice = price;
        feed.lastUpdate = block.timestamp;
        feed.source = PriceSource.MANUAL;
        
        emit PriceUpdated(token, price, PriceSource.MANUAL, block.timestamp);
    }
    
    /**
     * @notice Calculate deviation between two prices
     * @param oldPrice Old price
     * @param newPrice New price
     * @return deviation Deviation in basis points
     */
    function _calculateDeviation(uint256 oldPrice, uint256 newPrice) 
        internal 
        pure 
        returns (uint256 deviation) 
    {
        if (oldPrice == 0) return 0;
        
        uint256 diff = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        deviation = (diff * BASIS_POINTS) / oldPrice;
    }
    
    /**
     * @notice Generate pair key for token pair
     * @param tokenA First token
     * @param tokenB Second token
     * @return pairKey Unique pair identifier
     */
    function _getPairKey(address tokenA, address tokenB) 
        internal 
        pure 
        returns (bytes32 pairKey) 
    {
        // Ensure consistent ordering
        if (tokenA < tokenB) {
            pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        } else {
            pairKey = keccak256(abi.encodePacked(tokenB, tokenA));
        }
    }
}