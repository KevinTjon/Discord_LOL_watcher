import axios from 'axios';
import { SummonerData, MatchDetails, RankedData } from '../types';
import configService from '../config';
import storageService from './storageService';

// Cache for API responses to reduce API calls
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_EXPIRY = 60 * 1000; // 1 minute cache expiry

/**
 * Get a summoner's PUUID
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @returns {Promise<SummonerData | null>} Summoner data
 */
export async function getSummonerPUUID(summonerName: string, tagline: string): Promise<SummonerData | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `summoner:${summonerName.toLowerCase()}:${tagline.toLowerCase()}`;
        
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        
        console.log('Getting PUUID for', summonerName);
        const response = await axios.get(
            `https://${config.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagline)}?api_key=${config.riotApiKey}`
        );
        
        // Cache the response
        cache[cacheKey] = { data: response.data, timestamp: Date.now() };
        
        return response.data;
    } catch (error) {
        console.error('Error in getSummonerPUUID:', error);
        return null;
    }
}

/**
 * Get a summoner's latest game ID
 * @param {string} PUUID Player's PUUID
 * @returns {Promise<string | null>} Latest game ID
 */
export async function getLatestGameId(PUUID: string): Promise<string | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `matches:${PUUID}`;
        
        // Check cache (shorter expiry for match history as it changes more frequently)
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < (CACHE_EXPIRY / 2)) {
            return cache[cacheKey].data;
        }
        
        const response = await axios.get(
            `https://${config.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${PUUID}/ids?start=0&count=20&api_key=${config.riotApiKey}`
        );
        
        if (response.data.length > 0) {
            // Cache the response
            cache[cacheKey] = { data: response.data[0], timestamp: Date.now() };
            return response.data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error in getLatestGameId:', error);
        return null;
    }
}

/**
 * Get match details
 * @param {string} matchID Match ID
 * @returns {Promise<MatchDetails | null>} Match details
 */
export async function getMatchDetails(matchID: string): Promise<MatchDetails | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `match:${matchID}`;
        
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        
        const response = await axios.get(
            `https://${config.region}.api.riotgames.com/lol/match/v5/matches/${matchID}?api_key=${config.riotApiKey}`
        );
        
        // Create match details object with response data
        const matchDetails: MatchDetails = {
            data: response.data
        };
        
        // Cache the response
        cache[cacheKey] = { data: matchDetails, timestamp: Date.now() };
        
        return matchDetails;
    } catch (error) {
        console.error('Error in getMatchDetails:', error);
        return null;
    }
}

/**
 * Get ranked information for a summoner
 * @param {string} summonerId Summoner ID
 * @returns {Promise<RankedData | null>} Ranked data
 */
export async function getRankedInfo(summonerId: string): Promise<RankedData | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `ranked:${summonerId}`;
        
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        
        const response = await axios.get(
            `https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${config.riotApiKey}`
        );

        const rankedData: RankedData = {
            tier: "UNRANKED",
            rank: " ",
            leaguePoints: 0
        };

        // Find the solo/duo queue entry
        let soloDuoEntry = null;
        if (response.data.length > 0) {
            soloDuoEntry = response.data.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5');
        }

        if(soloDuoEntry) {
            rankedData.tier = soloDuoEntry.tier;
            rankedData.rank = soloDuoEntry.rank;
            rankedData.leaguePoints = soloDuoEntry.leaguePoints;
            
            // Calculate LP loss based on previous data
            const lpLoss = storageService.calculateLPLoss(
                summonerId, 
                rankedData.leaguePoints, 
                rankedData.tier, 
                rankedData.rank
            );
            
            if (lpLoss !== null) {
                rankedData.lpLoss = lpLoss;
            }
            
            // Update storage with current LP data for future comparison
            storageService.updatePlayerRank(
                summonerId,
                rankedData.tier,
                rankedData.rank,
                rankedData.leaguePoints
            );
        }
        
        // Cache the response
        cache[cacheKey] = { data: rankedData, timestamp: Date.now() };
        
        return rankedData;
    } catch (error) {
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
export async function extractDetails(matchDetails: MatchDetails, PUUID: string): Promise<string[] | null> {
    try {
        const details: string[] = [];
        const participants = matchDetails.data.metadata.participants;
        const info = matchDetails.data.info;
        
        let idNum: number | null = null;
        
        for(let i = 0; i < participants.length; i++) {
            if(PUUID === participants[i]) {
                idNum = i;
                break;
            }
        }

        if (idNum === null) {
            throw new Error('Summoner not found in match');
        }

        const participant = info.participants[idNum];
        details.push(participant.riotIdGameName);
        details.push(info.queueId.toString());
        details.push(participant.summonerId);
        details.push(participant.championId.toString());
        details.push(participant.championName);
        details.push(participant.individualPosition);
        details.push(participant.win.toString());
        
        const kills = participant.kills;
        const deaths = participant.deaths;
        const assists = participant.assists;
        const kda = `${kills}/${deaths}/${assists}`;
        details.push(kda);

        // Fetch rank data - getRankedInfo will handle storing it
        const rankedData = await getRankedInfo(participant.summonerId);
        if (rankedData) {
            // Attach rank data to match details for reference
            matchDetails.rankedData = rankedData;
        }

        return details;
    } catch (error) {
        console.error('Error in extractDetails:', error);
        return null;
    }
}

export default {
    getSummonerPUUID,
    getLatestGameId,
    getMatchDetails,
    getRankedInfo,
    extractDetails
}; 