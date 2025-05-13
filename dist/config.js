"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.addSummoner = addSummoner;
exports.removeSummoner = removeSummoner;
exports.updateSummonerLastMatch = updateSummonerLastMatch;
exports.updateSummonerLastTFTMatch = updateSummonerLastTFTMatch;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config();
// Default configuration
const defaultConfig = {
    summoners: [],
    region: process.env.REGION || 'americas',
    riotApiKey: process.env.RIOT_API_KEY || '',
    discordToken: process.env.DISCORD_TOKEN || '',
    discordChannelId: process.env.DISCORD_CHANNEL_ID || ''
};
// Config file path
const configPath = path_1.default.join(__dirname, '..', 'config.json');
/**
 * Load configuration from file
 * @returns {Config} Configuration object
 */
function loadConfig() {
    try {
        // Load environment variables first
        const envConfig = {
            region: process.env.REGION,
            riotApiKey: process.env.RIOT_API_KEY,
            discordToken: process.env.DISCORD_TOKEN,
            discordChannelId: process.env.DISCORD_CHANNEL_ID,
            tftDiscordChannelId: process.env.TFT_DISCORD_CHANNEL_ID,
            guildId: process.env.GUILD_ID
        };
        console.log('Environment variables loaded. Token available:', !!envConfig.discordToken);
        // If this is a cloud environment (like Render), prioritize environment variables
        if (process.env.RENDER || process.env.NODE_ENV === 'production') {
            console.log('Running in cloud environment, using environment variables');
            return {
                summoners: [],
                region: envConfig.region || 'americas',
                riotApiKey: envConfig.riotApiKey || '',
                discordToken: envConfig.discordToken || '',
                discordChannelId: envConfig.discordChannelId || '',
                tftDiscordChannelId: envConfig.tftDiscordChannelId || '',
                guildId: envConfig.guildId
            };
        }
        // For local development, try to load from config file first
        if (fs_1.default.existsSync(configPath)) {
            const fileConfig = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
            // Merge file config with environment variables
            // Environment variables take precedence over file config
            return {
                ...fileConfig,
                region: envConfig.region || fileConfig.region,
                riotApiKey: envConfig.riotApiKey || fileConfig.riotApiKey,
                discordToken: envConfig.discordToken || fileConfig.discordToken,
                discordChannelId: envConfig.discordChannelId || fileConfig.discordChannelId,
                tftDiscordChannelId: envConfig.tftDiscordChannelId || fileConfig.tftDiscordChannelId,
                guildId: envConfig.guildId || fileConfig.guildId
            };
        }
        console.log('Config file not found, creating with default values');
        // Create a basic config with environment variables
        const newConfig = {
            summoners: [],
            region: envConfig.region || 'americas',
            riotApiKey: envConfig.riotApiKey || '',
            discordToken: envConfig.discordToken || '',
            discordChannelId: envConfig.discordChannelId || '',
            tftDiscordChannelId: envConfig.tftDiscordChannelId || '',
            guildId: envConfig.guildId
        };
        saveConfig(newConfig);
        return newConfig;
    }
    catch (error) {
        console.error('Error loading config:', error);
        return defaultConfig;
    }
}
/**
 * Save configuration to file
 * @param {Config} config Configuration object
 */
function saveConfig(config) {
    try {
        fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('Error saving config:', error);
    }
}
/**
 * Add a summoner to the configuration
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @param {string} discordUsername Discord username
 * @returns {boolean} Whether the summoner was added
 */
function addSummoner(summonerName, tagline, discordUsername) {
    const config = loadConfig();
    const summonerExists = config.summoners.find(summoner => summoner.name.toLowerCase() === summonerName.toLowerCase() &&
        summoner.tagline.toLowerCase() === tagline.toLowerCase());
    if (!summonerExists) {
        config.summoners.push({
            name: summonerName,
            tagline: tagline,
            discordUsername: discordUsername,
            lastMatchId: null
        });
        saveConfig(config);
        console.log(`Summoner ${summonerName}#${tagline} linked to ${discordUsername} added to config.`);
        return true;
    }
    else {
        console.log(`Summoner ${summonerName}#${tagline} already exists in config.`);
        return false;
    }
}
/**
 * Remove a summoner from the configuration
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @returns {boolean} Whether the summoner was removed
 */
function removeSummoner(summonerName, tagline) {
    const config = loadConfig();
    const initialLength = config.summoners.length;
    config.summoners = config.summoners.filter(summoner => summoner.name.toLowerCase() !== summonerName.toLowerCase() ||
        summoner.tagline.toLowerCase() !== tagline.toLowerCase());
    // Check if we actually removed something
    if (config.summoners.length < initialLength) {
        saveConfig(config);
        console.log(`Summoner ${summonerName}#${tagline} removed from config.`);
        return true;
    }
    else {
        console.log(`Summoner ${summonerName}#${tagline} not found in config.`);
        return false;
    }
}
/**
 * Update a summoner's last match ID
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @param {string} lastMatchId Last match ID
 */
function updateSummonerLastMatch(summonerName, tagline, lastMatchId) {
    const config = loadConfig();
    const summoner = config.summoners.find(s => s.name.toLowerCase() === summonerName.toLowerCase() &&
        s.tagline.toLowerCase() === tagline.toLowerCase());
    if (summoner) {
        summoner.lastMatchId = lastMatchId;
        saveConfig(config);
    }
}
/**
 * Update a summoner's last TFT match ID
 * @param {string} summonerName Summoner name
 * @param {string} tagline Summoner tagline
 * @param {string} lastTFTMatchId Last TFT match ID
 */
function updateSummonerLastTFTMatch(summonerName, tagline, lastTFTMatchId) {
    const config = loadConfig();
    const summoner = config.summoners.find(s => s.name.toLowerCase() === summonerName.toLowerCase() &&
        s.tagline.toLowerCase() === tagline.toLowerCase());
    if (summoner) {
        summoner.lastTFTMatchId = lastTFTMatchId;
        saveConfig(config);
    }
}
exports.default = {
    loadConfig,
    saveConfig,
    addSummoner,
    removeSummoner,
    updateSummonerLastMatch,
    updateSummonerLastTFTMatch
};
