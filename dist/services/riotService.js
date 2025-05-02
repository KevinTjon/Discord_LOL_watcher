"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummonerPUUID = getSummonerPUUID;
exports.getLatestGameId = getLatestGameId;
exports.getMatchDetails = getMatchDetails;
exports.getRankedInfo = getRankedInfo;
exports.extractDetails = extractDetails;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const storageService_1 = __importDefault(require("./storageService"));
// Cache for API responses to reduce API calls
const cache = {};
const CACHE_EXPIRY = 60 * 1000; // 1 minute cache expiry
/**
 * Get a summoner's PUUID
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @returns {Promise<SummonerData | null>} Summoner data
 */
async function getSummonerPUUID(summonerName, tagline) {
    try {
        const config = config_1.default.loadConfig();
        const cacheKey = `summoner:${summonerName.toLowerCase()}:${tagline.toLowerCase()}`;
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        console.log('Getting PUUID for', summonerName);
        const response = await axios_1.default.get(`https://${config.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagline)}?api_key=${config.riotApiKey}`);
        // Cache the response
        cache[cacheKey] = { data: response.data, timestamp: Date.now() };
        return response.data;
    }
    catch (error) {
        console.error('Error in getSummonerPUUID:', error);
        return null;
    }
}
/**
 * Get a summoner's latest game ID
 * @param {string} PUUID Player's PUUID
 * @returns {Promise<string | null>} Latest game ID
 */
async function getLatestGameId(PUUID) {
    try {
        const config = config_1.default.loadConfig();
        const cacheKey = `matches:${PUUID}`;
        // Check cache (shorter expiry for match history as it changes more frequently)
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < (CACHE_EXPIRY / 2)) {
            return cache[cacheKey].data;
        }
        const response = await axios_1.default.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${PUUID}/ids?start=0&count=20&api_key=${config.riotApiKey}`);
        if (response.data.length > 0) {
            // Cache the response
            cache[cacheKey] = { data: response.data[0], timestamp: Date.now() };
            return response.data[0];
        }
        return null;
    }
    catch (error) {
        console.error('Error in getLatestGameId:', error);
        return null;
    }
}
/**
 * Get match details
 * @param {string} matchID Match ID
 * @returns {Promise<MatchDetails | null>} Match details
 */
async function getMatchDetails(matchID) {
    try {
        const config = config_1.default.loadConfig();
        const cacheKey = `match:${matchID}`;
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        const response = await axios_1.default.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/${matchID}?api_key=${config.riotApiKey}`);
        // Cache the response
        cache[cacheKey] = { data: response, timestamp: Date.now() };
        return response;
    }
    catch (error) {
        console.error('Error in getMatchDetails:', error);
        return null;
    }
}
/**
 * Get ranked information for a summoner
 * @param {string} summonerId Summoner ID
 * @returns {Promise<RankedData | null>} Ranked data
 */
async function getRankedInfo(summonerId) {
    try {
        const config = config_1.default.loadConfig();
        const cacheKey = `ranked:${summonerId}`;
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        const response = await axios_1.default.get(`https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${config.riotApiKey}`);
        const rankedData = {
            tier: "UNRANKED",
            rank: " ",
            leaguePoints: 0
        };
        if (response.data.length > 0) {
            rankedData.tier = response.data[0].tier;
            rankedData.rank = response.data[0].rank;
            rankedData.leaguePoints = response.data[0].leaguePoints;
            // Calculate LP loss based on previous data
            const lpLoss = storageService_1.default.calculateLPLoss(summonerId, rankedData.leaguePoints, rankedData.tier, rankedData.rank);
            if (lpLoss !== null) {
                rankedData.lpLoss = lpLoss;
            }
            // Update storage with current LP data for future comparison
            storageService_1.default.updatePlayerRank(summonerId, rankedData.tier, rankedData.rank, rankedData.leaguePoints);
        }
        // Cache the response
        cache[cacheKey] = { data: rankedData, timestamp: Date.now() };
        return rankedData;
    }
    catch (error) {
        console.error('Error fetching ranked info:', error);
        return null;
    }
}
/**
 * Extract details from match data
 * @param {MatchDetails} matchDetails Match details
 * @param {string} PUUID Player's PUUID
 * @returns {Promise<string[] | null>} Extracted details
 */
async function extractDetails(matchDetails, PUUID) {
    try {
        const details = [];
        const participants = matchDetails.data.metadata.participants;
        const info = matchDetails.data.info;
        let idNum = null;
        for (let i = 0; i < participants.length; i++) {
            if (PUUID === participants[i]) {
                idNum = i;
                break;
            }
        }
        if (idNum === null) {
            throw new Error('Summoner not found in match');
        }
        details.push(info.participants[idNum].riotIdGameName);
        details.push(info.queueId.toString());
        details.push(info.participants[idNum].summonerId);
        details.push(info.participants[idNum].championId.toString());
        details.push(info.participants[idNum].championName);
        details.push(info.participants[idNum].individualPosition);
        details.push(info.participants[idNum].win.toString());
        const kills = info.participants[idNum].kills;
        const deaths = info.participants[idNum].deaths;
        const assists = info.participants[idNum].assists;
        const kda = `${kills}/${deaths}/${assists}`;
        details.push(kda);
        return details;
    }
    catch (error) {
        console.error('Error in extractDetails:', error);
        return null;
    }
}
exports.default = {
    getSummonerPUUID,
    getLatestGameId,
    getMatchDetails,
    getRankedInfo,
    extractDetails
};
