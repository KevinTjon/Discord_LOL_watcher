/**
 * Represents a summoner being tracked by the bot
 */
export interface Summoner {
  name: string;
  tagline: string;
  discordUsername: string;
  lastMatchId: string | null;
}

/**
 * Represents the configuration for the bot
 */
export interface Config {
  summoners: Summoner[];
  region: string;
  riotApiKey: string;
  discordToken: string;
  discordChannelId: string;
  guildId?: string; // Optional guild ID for testing slash commands
}

/**
 * Represents a summoner's ranked information
 */
export interface RankedInfo {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

/**
 * Represents a summoner's basic information
 */
export interface SummonerData {
  puuid: string;
  id: string;
  name: string;
  profileIconId: number;
  summonerLevel: number;
} 