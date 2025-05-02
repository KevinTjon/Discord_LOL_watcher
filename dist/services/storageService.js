"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlayerRank = updatePlayerRank;
exports.getPreviousRankData = getPreviousRankData;
exports.updateTFTPlayerRank = updateTFTPlayerRank;
exports.getPreviousTFTRankData = getPreviousTFTRankData;
exports.calculateLPLoss = calculateLPLoss;
exports.calculateTFTLPLoss = calculateTFTLPLoss;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Path to the storage file
const storagePath = path_1.default.join(__dirname, '../..', 'data', 'storage.json');
/**
 * Initialize storage if it doesn't exist
 */
function initStorage() {
    // Create data directory if it doesn't exist
    const dataDir = path_1.default.join(__dirname, '../..', 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    // Create storage file if it doesn't exist
    if (!fs_1.default.existsSync(storagePath)) {
        const initialData = {
            playerRanks: {},
            tftPlayerRanks: {}
        };
        fs_1.default.writeFileSync(storagePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }
    // Update existing storage file if it doesn't have tftPlayerRanks
    try {
        const data = JSON.parse(fs_1.default.readFileSync(storagePath, 'utf-8'));
        if (!data.tftPlayerRanks) {
            data.tftPlayerRanks = {};
            fs_1.default.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf-8');
        }
    }
    catch (error) {
        console.error('Error updating storage structure:', error);
    }
}
/**
 * Load data from storage
 * @returns {StorageData} Storage data
 */
function loadStorage() {
    initStorage();
    try {
        const data = fs_1.default.readFileSync(storagePath, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('Error loading storage data:', error);
        return { playerRanks: {}, tftPlayerRanks: {} };
    }
}
/**
 * Save data to storage
 * @param {StorageData} data Data to save
 */
function saveStorage(data) {
    try {
        fs_1.default.writeFileSync(storagePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('Error saving storage data:', error);
    }
}
/**
 * Update player rank data
 * @param {string} summonerId Summoner ID
 * @param {string} tier Player's tier
 * @param {string} rank Player's rank
 * @param {number} leaguePoints Player's LP
 */
function updatePlayerRank(summonerId, tier, rank, leaguePoints) {
    const storage = loadStorage();
    storage.playerRanks[summonerId] = {
        summonerId,
        tier,
        rank,
        leaguePoints,
        timestamp: Date.now()
    };
    saveStorage(storage);
}
/**
 * Get previous player rank data
 * @param {string} summonerId Summoner ID
 * @returns {PlayerRankData | null} Previous rank data or null if not found
 */
function getPreviousRankData(summonerId) {
    const storage = loadStorage();
    return storage.playerRanks[summonerId] || null;
}
/**
 * Update TFT player rank data
 * @param {string} puuid Player's PUUID
 * @param {string} tier Player's tier
 * @param {string} rank Player's rank
 * @param {number} leaguePoints Player's LP
 */
function updateTFTPlayerRank(puuid, tier, rank, leaguePoints) {
    const storage = loadStorage();
    storage.tftPlayerRanks[puuid] = {
        puuid,
        tier,
        rank,
        leaguePoints,
        timestamp: Date.now()
    };
    saveStorage(storage);
}
/**
 * Get previous TFT player rank data
 * @param {string} puuid Player's PUUID
 * @returns {TFTPlayerRankData | null} Previous rank data or null if not found
 */
function getPreviousTFTRankData(puuid) {
    const storage = loadStorage();
    return storage.tftPlayerRanks[puuid] || null;
}
/**
 * Calculate LP loss since last check
 * @param {string} summonerId Summoner ID
 * @param {number} currentLP Current LP
 * @param {string} currentTier Current tier
 * @param {string} currentRank Current rank
 * @returns {number | null} LP loss or null if no previous data or not in same tier/rank
 */
function calculateLPLoss(summonerId, currentLP, currentTier, currentRank) {
    const previousData = getPreviousRankData(summonerId);
    if (!previousData) {
        return null;
    }
    // Handle high elo tiers without divisions (MASTER, GRANDMASTER, CHALLENGER)
    const highEloTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
    // If same tier in high elo, just compare LP
    if (previousData.tier === currentTier && highEloTiers.includes(currentTier)) {
        if (currentLP < previousData.leaguePoints) {
            return previousData.leaguePoints - currentLP;
        }
        return null;
    }
    // Demotions between high elo tiers (Challenger → Grandmaster → Master)
    if (highEloTiers.includes(previousData.tier) && highEloTiers.includes(currentTier) &&
        isTierDemotion(previousData.tier, currentTier)) {
        // Use the same LP loss calculation for high ELO tier demotions
        // LP loss is simply the difference between previous and current LP
        return previousData.leaguePoints - currentLP;
    }
    // If same tier and rank, normal LP loss calculation
    if (previousData.tier === currentTier && previousData.rank === currentRank) {
        // If currentLP is less than previous LP, it's a loss
        if (currentLP < previousData.leaguePoints) {
            return previousData.leaguePoints - currentLP;
        }
    }
    // Handle tier demotion cases
    else if (
    // Diamond 4 -> Emerald 1
    (previousData.tier === 'DIAMOND' && previousData.rank === 'IV' &&
        currentTier === 'EMERALD' && currentRank === 'I') ||
        // Masters -> Diamond 1
        (previousData.tier === 'MASTER' &&
            currentTier === 'DIAMOND' && currentRank === 'I') ||
        // Other tier demotions (general case)
        (isTierDemotion(previousData.tier, currentTier) && currentRank === 'I')) {
        // For tier demotions, use a fixed LP loss value
        return 25; // Standard LP loss for tier demotions
    }
    // Handle division demotion cases (within the same tier)
    else if (previousData.tier === currentTier && isDivisionDemotion(previousData.rank, currentRank)) {
        // For division demotions, calculate LP loss: previous LP + (100 - current LP)
        // Example: Diamond 1 (2 LP) → Diamond 2 (82 LP) = 2 + (100 - 82) = 20 LP loss
        return previousData.leaguePoints + (100 - currentLP);
    }
    // If tier/rank changed but not a demotion case, don't show LP loss
    return null;
}
/**
 * Calculate TFT LP loss since last check (similar to LoL but with TFT-specific logic)
 * @param {string} puuid Player's PUUID
 * @param {number} currentLP Current LP
 * @param {string} currentTier Current tier
 * @param {string} currentRank Current rank
 * @returns {number | null} LP loss or null if no previous data or not in same tier/rank
 */
function calculateTFTLPLoss(puuid, currentLP, currentTier, currentRank) {
    const previousData = getPreviousTFTRankData(puuid);
    if (!previousData) {
        return null;
    }
    // TFT uses the same tier system as LoL, so we can reuse most of the logic
    // Handle high elo tiers without divisions (MASTER, GRANDMASTER, CHALLENGER)
    const highEloTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
    // If same tier in high elo, just compare LP
    if (previousData.tier === currentTier && highEloTiers.includes(currentTier)) {
        if (currentLP < previousData.leaguePoints) {
            return previousData.leaguePoints - currentLP;
        }
        return null;
    }
    // Demotions between high elo tiers (Challenger → Grandmaster → Master)
    if (highEloTiers.includes(previousData.tier) && highEloTiers.includes(currentTier) &&
        isTierDemotion(previousData.tier, currentTier)) {
        return previousData.leaguePoints - currentLP;
    }
    // If same tier and rank, normal LP loss calculation
    if (previousData.tier === currentTier && previousData.rank === currentRank) {
        // If currentLP is less than previous LP, it's a loss
        if (currentLP < previousData.leaguePoints) {
            return previousData.leaguePoints - currentLP;
        }
    }
    // Handle tier demotion cases
    else if (
    // Diamond 4 -> Emerald 1
    (previousData.tier === 'DIAMOND' && previousData.rank === 'IV' &&
        currentTier === 'EMERALD' && currentRank === 'I') ||
        // Masters -> Diamond 1
        (previousData.tier === 'MASTER' &&
            currentTier === 'DIAMOND' && currentRank === 'I') ||
        // Other tier demotions (general case)
        (isTierDemotion(previousData.tier, currentTier) && currentRank === 'I')) {
        // For tier demotions, use a fixed LP loss value
        return 25; // Standard LP loss for tier demotions
    }
    // Handle division demotion cases (within the same tier)
    else if (previousData.tier === currentTier && isDivisionDemotion(previousData.rank, currentRank)) {
        // For division demotions, calculate LP loss: previous LP + (100 - current LP)
        return previousData.leaguePoints + (100 - currentLP);
    }
    // If tier/rank changed but not a demotion case, don't show LP loss
    return null;
}
/**
 * Check if there was a tier demotion
 * @param {string} previousTier Previous tier
 * @param {string} currentTier Current tier
 * @returns {boolean} True if it's a tier demotion
 */
function isTierDemotion(previousTier, currentTier) {
    const tierOrder = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'IRON'];
    const previousIndex = tierOrder.indexOf(previousTier);
    const currentIndex = tierOrder.indexOf(currentTier);
    // If current tier is lower in the list (higher index), it's a demotion
    return previousIndex < currentIndex;
}
/**
 * Check if there was a division demotion within the same tier
 * @param {string} previousRank Previous rank (I, II, III, IV)
 * @param {string} currentRank Current rank
 * @returns {boolean} True if it's a division demotion
 */
function isDivisionDemotion(previousRank, currentRank) {
    // For tiers without divisions (MASTER, GRANDMASTER, CHALLENGER)
    // these values shouldn't even be compared
    if (previousRank === '' || currentRank === '') {
        return false;
    }
    const rankOrder = ['I', 'II', 'III', 'IV'];
    const previousIndex = rankOrder.indexOf(previousRank);
    const currentIndex = rankOrder.indexOf(currentRank);
    // If current rank is lower in the list (higher index), it's a demotion
    return previousIndex < currentIndex;
}
exports.default = {
    updatePlayerRank,
    getPreviousRankData,
    calculateLPLoss,
    updateTFTPlayerRank,
    getPreviousTFTRankData,
    calculateTFTLPLoss
};
