"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = __importDefault(require("./config"));
const riotService_1 = __importDefault(require("./services/riotService"));
const imageService_1 = __importDefault(require("./services/imageService"));
const tftService_1 = __importDefault(require("./services/tftService"));
const tftImageService_1 = __importDefault(require("./services/tftImageService"));
const index_1 = require("./commands/index");
const handlers_1 = require("./commands/handlers");
// Create Discord client
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent
    ]
});
exports.client = client;
// Handle ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    try {
        // Wait 2 seconds before registering commands to ensure Discord has time to process
        console.log('Waiting 2 seconds before refreshing application commands...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Register slash commands
        const rest = new discord_js_1.REST({ version: '10' }).setToken(config_1.default.loadConfig().discordToken);
        console.log('Started refreshing application (/) commands.');
        const commandsData = index_1.commands.map(command => command.toJSON());
        if (client.application) {
            const config = config_1.default.loadConfig();
            // Try guild-specific registration if guildId is available (faster for testing)
            if (config.guildId) {
                console.log(`Registering commands for specific guild: ${config.guildId}`);
                await rest.put(discord_js_1.Routes.applicationGuildCommands(client.application.id, config.guildId), { body: commandsData });
            }
            else {
                // Global command registration (can take up to an hour to propagate)
                await rest.put(discord_js_1.Routes.applicationCommands(client.application.id), { body: commandsData });
            }
            console.log('Successfully reloaded application (/) commands.');
        }
        startMonitoring();
    }
    catch (error) {
        console.error('Error registering slash commands:', error);
    }
});
// Handle message events for backward compatibility
client.on('messageCreate', async (message) => {
    if (message.author.bot)
        return;
    const args = message.content.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (command === '!addsummoner') {
        await handleLegacyAddSummoner(message, args);
    }
});
// Handle interaction events (slash commands)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    try {
        switch (interaction.commandName) {
            case 'addsummoner':
                await (0, handlers_1.handleAddSummoner)(interaction);
                break;
            case 'listsummoners':
                await (0, handlers_1.handleListSummoners)(interaction);
                break;
            case 'removesummoner':
                await (0, handlers_1.handleRemoveSummoner)(interaction);
                break;
            case 'clearmessages':
                await (0, handlers_1.handleClearMessages)(interaction);
                break;
            case 'togglementions':
                await (0, handlers_1.handleToggleMentions)(interaction);
                break;
            default:
                await interaction.reply({ content: 'Unknown command', ephemeral: true });
        }
    }
    catch (error) {
        console.error('Error handling command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
        else if (!interaction.replied) {
            await interaction.editReply('An error occurred while processing the command.');
        }
    }
});
/**
 * Handle the legacy !addsummoner command
 * @param {Message} message Discord message
 * @param {string[]} args Command arguments
 */
async function handleLegacyAddSummoner(message, args) {
    const input = args.join(' ');
    const [summonerInfo, discordUsername] = input.split(' ');
    if (!summonerInfo || !summonerInfo.includes('#') || !discordUsername) {
        await message.channel.send('Please provide input in the format "SummonerName#Tagline DiscordUsername".');
        return;
    }
    const [summonerName, tagline] = summonerInfo.split('#');
    if (!summonerName || !tagline) {
        await message.channel.send('Invalid summoner name format. Please provide in the format "SummonerName#Tagline".');
        return;
    }
    // Verify that the summoner exists before adding
    const summonerData = await riotService_1.default.getSummonerPUUID(summonerName, tagline);
    if (!summonerData) {
        await message.channel.send(`Summoner ${summonerName}#${tagline} not found. Please check the name and tagline.`);
        return;
    }
    const added = config_1.default.addSummoner(summonerName, tagline, discordUsername);
    if (added) {
        await message.channel.send(`Summoner ${summonerName}#${tagline} linked to ${discordUsername}.`);
    }
    else {
        await message.channel.send(`Summoner ${summonerName}#${tagline} is already being tracked.`);
    }
}
/**
 * Process a ranked match loss
 * @param {string[]} details Match details
 * @param {string} discordUsername Discord username
 */
async function processRankedLoss(details, discordUsername) {
    try {
        // Get ranked data
        const rankedData = await riotService_1.default.getRankedInfo(details[2]);
        if (!rankedData) {
            console.error('Failed to get ranked data');
            return;
        }
        console.log("Processing ranked loss");
        // Generate image
        const imageBuffer = await imageService_1.default.generateImage(details, rankedData);
        console.log("Image generated");
        // Get Discord channel
        const config = config_1.default.loadConfig();
        const channel = client.channels.cache.get(config.discordChannelId);
        // Use global mention setting
        const mentionsEnabled = config.mentionsEnabled ?? true;
        if (channel) {
            console.log("Sending loss to channel");
            // Send message with image
            const message = imageService_1.default.getTauntMessage(discordUsername, imageBuffer, mentionsEnabled);
            await channel.send(message);
        }
        else {
            console.error('Channel not found for loss notification.');
        }
    }
    catch (error) {
        console.error('Error processing ranked loss:', error);
    }
}
/**
 * Check if the match is a ranked loss
 * @param {string[]} details Match details
 * @param {string} discordUsername Discord username
 */
async function isRankedLoss(details, discordUsername) {
    // Check if it's a ranked game (queueId 420) and a loss
    if (details[1] === '420' && details[6] !== 'true') {
        await processRankedLoss(details, discordUsername);
    }
    else {
        console.log("New game found was either not ranked or a win");
    }
}
/**
 * Process a TFT ranked loss
 * @param {TFTMatchDetails} matchDetails TFT match details
 * @param {string} discordUsername Discord username
 */
async function processTFTRankedLoss(matchDetails, discordUsername, PUUID) {
    try {
        // Get ranked data
        const rankedData = await tftService_1.default.getTFTRankedInfo(PUUID);
        if (!rankedData) {
            console.error('Failed to get TFT ranked data');
            return;
        }
        console.log("Processing TFT ranked loss");
        // Get summoner name and config
        const config = config_1.default.loadConfig();
        const summoner = config.summoners.find(s => s.discordUsername === discordUsername);
        const summonerName = summoner ? summoner.name : "Unknown";
        // Use global mention setting
        const mentionsEnabled = config.mentionsEnabled ?? true;
        // Generate image
        const imageBuffer = await tftImageService_1.default.generateImage(matchDetails, rankedData, summonerName);
        console.log("TFT image generated");
        // Get Discord channel
        const channelId = config.tftDiscordChannelId || config.discordChannelId;
        const channel = client.channels.cache.get(channelId);
        if (channel) {
            console.log("Sending TFT loss to channel");
            // Send message with image
            const message = tftImageService_1.default.getTauntMessage(discordUsername, imageBuffer, mentionsEnabled);
            await channel.send(message);
        }
        else {
            console.error('Channel not found for TFT loss notification.');
        }
    }
    catch (error) {
        console.error('Error processing TFT ranked loss:', error);
    }
}
/**
 * Start monitoring summoners
 */
async function startMonitoring() {
    try {
        // Schedule the check every minute
        node_cron_1.default.schedule('* * * * *', async () => {
            const config = config_1.default.loadConfig();
            // Process each summoner
            for (const summoner of config.summoners) {
                try {
                    console.log("Getting latest game ID for", summoner.name);
                    const summonerData = await riotService_1.default.getSummonerPUUID(summoner.name, summoner.tagline);
                    if (!summonerData) {
                        console.error(`Failed to get data for ${summoner.name}#${summoner.tagline}`);
                        continue;
                    }
                    const PUUID = summonerData.puuid;
                    // Check for League of Legends losses
                    console.log("Starting LoL monitoring for", summoner.name);
                    const latestGameId = await riotService_1.default.getLatestGameId(PUUID);
                    console.log("Latest LoL game ID:", latestGameId);
                    // If new game found and not already processed
                    if (latestGameId && latestGameId !== summoner.lastMatchId) {
                        const matchDetails = await riotService_1.default.getMatchDetails(latestGameId);
                        if (matchDetails) {
                            const details = await riotService_1.default.extractDetails(matchDetails, PUUID);
                            if (details) {
                                console.log("LoL match details:", details);
                                await isRankedLoss(details, summoner.discordUsername);
                                // Update last match ID
                                config_1.default.updateSummonerLastMatch(summoner.name, summoner.tagline, latestGameId);
                            }
                        }
                    }
                    // Check for TFT losses
                    console.log("Starting TFT monitoring for", summoner.name);
                    const latestTFTMatchId = await tftService_1.default.getLatestTFTMatchId(PUUID);
                    console.log("Latest TFT match ID:", latestTFTMatchId);
                    // If new TFT game found and not already processed
                    if (latestTFTMatchId && latestTFTMatchId !== summoner.lastTFTMatchId) {
                        const tftMatchDetails = await tftService_1.default.getTFTMatchDetails(latestTFTMatchId, PUUID);
                        if (tftMatchDetails) {
                            console.log("TFT match details:", tftMatchDetails);
                            // Check if it's a ranked loss (placement 5-8)
                            if (tftService_1.default.isTFTRankedLoss(tftMatchDetails)) {
                                await processTFTRankedLoss(tftMatchDetails, summoner.discordUsername, PUUID);
                            }
                            else {
                                console.log("TFT game was either not ranked or not a loss (placement better than 5th)");
                            }
                            // Update last TFT match ID
                            config_1.default.updateSummonerLastTFTMatch(summoner.name, summoner.tagline, latestTFTMatchId);
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing summoner ${summoner.name}:`, error);
                    // Continue with next summoner
                    continue;
                }
            }
        });
        console.log("Monitoring started");
    }
    catch (error) {
        console.error('Error during monitoring:', error);
    }
}
// Login to Discord
client.login(config_1.default.loadConfig().discordToken).catch(error => {
    console.error('Failed to login:', error);
});
