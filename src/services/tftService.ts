import axios from 'axios';
import { SummonerData, TFTMatchDetails, TFTRankedData } from '../types';
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
 * Get a summoner's latest TFT match ID
 * @param {string} PUUID Player's PUUID
 * @returns {Promise<string | null>} Latest match ID
 */
export async function getLatestTFTMatchId(PUUID: string): Promise<string | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `tft-matches:${PUUID}`;
        
        // Check cache (shorter expiry for match history as it changes more frequently)
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < (CACHE_EXPIRY / 2)) {
            return cache[cacheKey].data;
        }
        
        // Note: TFT match history uses regional routing values instead of platform routing values
        // Map the platform region to the corresponding regional routing value
        const regionalRouting = getRegionalRouting(config.region);
        
        const response = await axios.get(
            `https://${regionalRouting}.api.riotgames.com/tft/match/v1/matches/by-puuid/${PUUID}/ids?count=20&api_key=${config.riotApiKey}`
        );
        
        if (response.data.length > 0) {
            // Cache the response
            cache[cacheKey] = { data: response.data[0], timestamp: Date.now() };
            return response.data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error in getLatestTFTMatchId:', error);
        return null;
    }
}

/**
 * Get TFT match details
 * @param {string} matchID Match ID
 * @param {string} PUUID Player's PUUID to extract their details
 * @returns {Promise<TFTMatchDetails | null>} Match details
 */
export async function getTFTMatchDetails(matchID: string, PUUID: string): Promise<TFTMatchDetails | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `tft-match:${matchID}`;
        
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            const cachedData = cache[cacheKey].data;
            return extractTFTMatchDetails(cachedData, PUUID);
        }
        
        // Map the platform region to the corresponding regional routing value
        const regionalRouting = getRegionalRouting(config.region);
        
        const response = await axios.get(
            `https://${regionalRouting}.api.riotgames.com/tft/match/v1/matches/${matchID}?api_key=${config.riotApiKey}`
        );
        
        // Cache the response
        cache[cacheKey] = { data: response.data, timestamp: Date.now() };
        
        return extractTFTMatchDetails(response.data, PUUID);
    } catch (error) {
        console.error('Error in getTFTMatchDetails:', error);
        return null;
    }
}

/**
 * Extract TFT match details for a specific player
 * @param {any} matchData The full match data
 * @param {string} PUUID The player's PUUID
 * @returns {TFTMatchDetails | null} Extracted match details
 */
function extractTFTMatchDetails(matchData: any, PUUID: string): TFTMatchDetails | null {
    try {
        const participant = matchData.info.participants.find((p: any) => p.puuid === PUUID);
        
        if (!participant) {
            throw new Error('Player not found in match data');
        }
        
        return {
            gameType: matchData.info.tft_game_type,
            queueId: matchData.info.queue_id,
            gameDatetime: matchData.info.game_datetime,
            gameLength: matchData.info.game_length,
            placement: participant.placement,
            level: participant.level,
            playersEliminated: participant.players_eliminated,
            totalDamageToPlayers: participant.total_damage_to_players,
            augments: participant.augments || [],
            traits: participant.traits || [],
            units: participant.units || []
        };
    } catch (error) {
        console.error('Error extracting TFT match details:', error);
        return null;
    }
}

/**
 * Get ranked information for a TFT player
 * @param {string} PUUID Player's PUUID
 * @returns {Promise<TFTRankedData | null>} Ranked data
 */
export async function getTFTRankedInfo(PUUID: string): Promise<TFTRankedData | null> {
    try {
        const config = configService.loadConfig();
        const cacheKey = `tft-ranked:${PUUID}`;
        
        // Check cache
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp) < CACHE_EXPIRY) {
            return cache[cacheKey].data;
        }
        
        // First, we need to get the summoner ID from the PUUID
        const summonerResponse = await axios.get(
            `https://na1.api.riotgames.com/tft/summoner/v1/summoners/by-puuid/${PUUID}?api_key=${config.riotApiKey}`
        );
        
        const summonerId = summonerResponse.data.id;
        
        // Now get the ranked data using the summoner ID
        const rankedResponse = await axios.get(
            `https://na1.api.riotgames.com/tft/league/v1/entries/by-summoner/${summonerId}?api_key=${config.riotApiKey}`
        );

        const rankedData: TFTRankedData = {
            tier: "UNRANKED",
            rank: "",
            leaguePoints: 0,
            wins: 0,
            losses: 0
        };

        if (rankedResponse.data.length > 0) {
            // Find the ranked TFT entry (queueType: RANKED_TFT)
            const rankedEntry = rankedResponse.data.find((entry: any) => entry.queueType === 'RANKED_TFT');
            
            if (rankedEntry) {
                rankedData.tier = rankedEntry.tier;
                rankedData.rank = rankedEntry.rank;
                rankedData.leaguePoints = rankedEntry.leaguePoints;
                rankedData.wins = rankedEntry.wins;
                rankedData.losses = rankedEntry.losses;
                
                // Calculate LP loss based on previous data
                const lpLoss = storageService.calculateTFTLPLoss(
                    PUUID, 
                    rankedData.leaguePoints, 
                    rankedData.tier, 
                    rankedData.rank
                );
                
                if (lpLoss !== null) {
                    rankedData.lpLoss = lpLoss;
                }
                
                // Update storage with current LP data for future comparison
                storageService.updateTFTPlayerRank(
                    PUUID,
                    rankedData.tier,
                    rankedData.rank,
                    rankedData.leaguePoints
                );
            }
        }
        
        // Cache the response
        cache[cacheKey] = { data: rankedData, timestamp: Date.now() };
        
        return rankedData;
    } catch (error) {
        console.error('Error fetching TFT ranked info:', error);
        return null;
    }
}

/**
 * Map platform routing to regional routing for TFT
 * @param {string} platform Platform routing value
 * @returns {string} Regional routing value
 */
function getRegionalRouting(platform: string): string {
    // AMERICAS serves NA, BR, LAN, LAS, OCE
    // ASIA serves KR and JP
    // EUROPE serves EUNE, EUW, TR, RU
    
    const regionMap: Record<string, string> = {
        'na1': 'AMERICAS',
        'br1': 'AMERICAS',
        'la1': 'AMERICAS', // LAN
        'la2': 'AMERICAS', // LAS
        'oc1': 'AMERICAS',
        'kr': 'ASIA',
        'jp1': 'ASIA',
        'eun1': 'EUROPE', // EUNE
        'euw1': 'EUROPE', // EUW
        'tr1': 'EUROPE',
        'ru': 'EUROPE',
        'americas': 'AMERICAS',
        'asia': 'ASIA',
        'europe': 'EUROPE'
    };
    
    return regionMap[platform.toLowerCase()] || 'AMERICAS'; // Default to AMERICAS if not found
}

/**
 * Check if a TFT match is a ranked loss (placement > 4)
 * @param {TFTMatchDetails} matchDetails Match details
 * @returns {boolean} Whether the match is a ranked loss
 */
export function isTFTRankedLoss(matchDetails: TFTMatchDetails): boolean {
    // For TFT, a loss is typically considered as placing 5th-8th in ranked
    // queueId 1100 is for ranked TFT
    return matchDetails.queueId === 1100 && matchDetails.placement > 4;
}

export default {
    getSummonerPUUID,
    getLatestTFTMatchId,
    getTFTMatchDetails,
    getTFTRankedInfo,
    isTFTRankedLoss
}; 