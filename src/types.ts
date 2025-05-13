export interface Summoner {
    name: string;
    tagline: string;
    discordUsername: string;
    lastMatchId: string | null;
    lastTFTMatchId?: string | null;
}

export interface Config {
    summoners: Summoner[];
    region: string;
    riotApiKey: string;
    discordToken: string;
    discordChannelId: string;
    tftDiscordChannelId?: string;
    guildId?: string;
    mentionsEnabled?: boolean;
}

export interface SummonerData {
    puuid: string;
    gameName: string;
    tagLine: string;
}

export interface MatchDetails {
    data: {
        metadata: {
            participants: string[];
        };
        info: {
            queueId: number;
            participants: Participant[];
        };
    };
    rankedData?: RankedData;
}

export interface Participant {
    riotIdGameName: string;
    summonerId: string;
    championId: number;
    championName: string;
    individualPosition: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
}

export interface RankedData {
    tier: string;
    rank: string;
    leaguePoints: number;
    lpLoss?: number;
}

export interface TFTMatchDetails {
    gameType: string;
    queueId: number;
    gameDatetime: number;
    gameLength: number;
    placement: number;
    level: number;
    playersEliminated: number;
    totalDamageToPlayers: number;
    augments: string[];
    traits: TFTTrait[];
    units: TFTUnit[];
}

export interface TFTTrait {
    name: string;
    num_units: number;
    style: number;
    tier_current: number;
    tier_total: number;
}

export interface TFTUnit {
    character_id: string;
    itemNames: string[];
    name: string;
    rarity: number;
    tier: number;
    items?: number[];
}

export interface TFTRankedData {
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
    lpLoss?: number;
}

export interface PlayerRankData {
    summonerId: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    timestamp: number;
}

export interface TFTPlayerRankData {
    puuid: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    timestamp: number;
} 