import { Client, GatewayIntentBits, TextChannel, Message, REST, Routes, Interaction } from 'discord.js';
import cron from 'node-cron';
import configService from './config';
import riotService from './services/riotService';
import imageService from './services/imageService';
import tftService from './services/tftService';
import tftImageService from './services/tftImageService';
import { commands } from './commands/index';
import { handleAddSummoner, handleListSummoners, handleRemoveSummoner, handleClearMessages } from './commands/handlers';
import { TFTMatchDetails } from './types';

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Handle ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    
    try {
        // Wait 2 seconds before registering commands to ensure Discord has time to process
        console.log('Waiting 2 seconds before refreshing application commands...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Register slash commands
        const rest = new REST({ version: '10' }).setToken(configService.loadConfig().discordToken);
        console.log('Started refreshing application (/) commands.');
        
        const commandsData = commands.map(command => command.toJSON());
        
        if (client.application) {
            const config = configService.loadConfig();
            
            // Try guild-specific registration if guildId is available (faster for testing)
            if (config.guildId) {
                console.log(`Registering commands for specific guild: ${config.guildId}`);
                await rest.put(
                    Routes.applicationGuildCommands(client.application.id, config.guildId),
                    { body: commandsData }
                );
            } else {
                // Global command registration (can take up to an hour to propagate)
                await rest.put(
                    Routes.applicationCommands(client.application.id),
                    { body: commandsData }
                );
            }
            
            console.log('Successfully reloaded application (/) commands.');
        }
        
        startMonitoring();
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// Handle message events for backward compatibility
client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === '!addsummoner') {
        await handleLegacyAddSummoner(message, args);
    }
});

// Handle interaction events (slash commands)
client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    switch (interaction.commandName) {
        case 'addsummoner':
            await handleAddSummoner(interaction);
            break;
        case 'listsummoners':
            await handleListSummoners(interaction);
            break;
        case 'removesummoner':
            await handleRemoveSummoner(interaction);
            break;
        case 'clearmessages':
            await handleClearMessages(interaction);
            break;
    }
});

/**
 * Handle the legacy !addsummoner command
 * @param {Message} message Discord message
 * @param {string[]} args Command arguments
 */
async function handleLegacyAddSummoner(message: Message, args: string[]): Promise<void> {
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
    const summonerData = await riotService.getSummonerPUUID(summonerName, tagline);
    if (!summonerData) {
        await message.channel.send(`Summoner ${summonerName}#${tagline} not found. Please check the name and tagline.`);
        return;
    }

    const added = configService.addSummoner(summonerName, tagline, discordUsername);
    
    if (added) {
        await message.channel.send(`Summoner ${summonerName}#${tagline} linked to ${discordUsername}.`);
    } else {
        await message.channel.send(`Summoner ${summonerName}#${tagline} is already being tracked.`);
    }
}

/**
 * Process a ranked match loss
 * @param {string[]} details Match details
 * @param {string} discordUsername Discord username
 */
async function processRankedLoss(details: string[], discordUsername: string): Promise<void> {
    try {
        // Get ranked data
        const rankedData = await riotService.getRankedInfo(details[2]);
        
        if (!rankedData) {
            console.error('Failed to get ranked data');
            return;
        }
        
        console.log("Processing ranked loss");
        
        // Generate image
        const imageBuffer = await imageService.generateImage(details, rankedData);
        console.log("Image generated");
        
        // Get Discord channel
        const config = configService.loadConfig();
        const channel = client.channels.cache.get(config.discordChannelId) as TextChannel;

        if (channel) {
            console.log("Sending to channel");
            // Send message with image
            const message = imageService.getTauntMessage(discordUsername, imageBuffer);
            await channel.send(message);
        } else {
            console.error('Channel not found.');
        }
    } catch (error) {
        console.error('Error processing ranked loss:', error);
    }
}

/**
 * Check if the match is a ranked loss
 * @param {string[]} details Match details
 * @param {string} discordUsername Discord username
 */
async function isRankedLoss(details: string[], discordUsername: string): Promise<void> {
    // Check if it's a ranked game (queueId 420) and a loss
    if (details[1] === '420' && details[6] !== 'true') {
        await processRankedLoss(details, discordUsername);
    } else {
        console.log("New game found was either not ranked or a win");
    }
}

/**
 * Process a TFT ranked loss
 * @param {TFTMatchDetails} matchDetails TFT match details
 * @param {string} discordUsername Discord username
 */
async function processTFTRankedLoss(matchDetails: TFTMatchDetails, discordUsername: string, PUUID: string): Promise<void> {
    try {
        // Get ranked data
        const rankedData = await tftService.getTFTRankedInfo(PUUID);
        
        if (!rankedData) {
            console.error('Failed to get TFT ranked data');
            return;
        }
        
        console.log("Processing TFT ranked loss");
        
        // Get summoner name
        const config = configService.loadConfig();
        const summoner = config.summoners.find(s => s.discordUsername === discordUsername);
        const summonerName = summoner ? summoner.name : "Unknown";
        
        // Generate image
        const imageBuffer = await tftImageService.generateImage(matchDetails, rankedData, summonerName);
        console.log("TFT image generated");
        
        // Get Discord channel
        const channelId = config.tftDiscordChannelId || config.discordChannelId;
        const channel = client.channels.cache.get(channelId) as TextChannel;

        if (channel) {
            console.log("Sending TFT loss to channel");
            // Send message with image
            const message = tftImageService.getTauntMessage(discordUsername, imageBuffer);
            await channel.send(message);
        } else {
            console.error('Channel not found for TFT loss notification.');
        }
    } catch (error) {
        console.error('Error processing TFT ranked loss:', error);
    }
}

/**
 * Start monitoring summoners
 */
async function startMonitoring(): Promise<void> {
    try {
        // Schedule the check every minute
        cron.schedule('* * * * *', async () => {
            const config = configService.loadConfig();
            
            // Process each summoner
            for (const summoner of config.summoners) {
                try {
                    console.log("Getting latest game ID for", summoner.name);
                    const summonerData = await riotService.getSummonerPUUID(summoner.name, summoner.tagline);
                    
                    if (!summonerData) {
                        console.error(`Failed to get data for ${summoner.name}#${summoner.tagline}`);
                        continue;
                    }
                    
                    const PUUID = summonerData.puuid;
                    
                    // Check for League of Legends losses
                    console.log("Starting LoL monitoring for", summoner.name);
                    
                    const latestGameId = await riotService.getLatestGameId(PUUID);
                    console.log("Latest LoL game ID:", latestGameId);
                    
                    // If new game found and not already processed
                    if (latestGameId && latestGameId !== summoner.lastMatchId) {
                        const matchDetails = await riotService.getMatchDetails(latestGameId);
                        
                        if (matchDetails) {
                            const details = await riotService.extractDetails(matchDetails, PUUID);
                            
                            if (details) {
                                console.log("LoL match details:", details);
                                await isRankedLoss(details, summoner.discordUsername);
                                
                                // Update last match ID
                                configService.updateSummonerLastMatch(summoner.name, summoner.tagline, latestGameId);
                            }
                        }
                    }
                    
                    // Check for TFT losses
                    console.log("Starting TFT monitoring for", summoner.name);
                    
                    const latestTFTMatchId = await tftService.getLatestTFTMatchId(PUUID);
                    console.log("Latest TFT match ID:", latestTFTMatchId);
                    
                    // If new TFT game found and not already processed
                    if (latestTFTMatchId && latestTFTMatchId !== summoner.lastTFTMatchId) {
                        const tftMatchDetails = await tftService.getTFTMatchDetails(latestTFTMatchId, PUUID);
                        
                        if (tftMatchDetails) {
                            console.log("TFT match details:", tftMatchDetails);
                            
                            // Check if it's a ranked loss (placement 5-8)
                            if (tftService.isTFTRankedLoss(tftMatchDetails)) {
                                await processTFTRankedLoss(tftMatchDetails, summoner.discordUsername, PUUID);
                            } else {
                                console.log("TFT game was either not ranked or not a loss (placement better than 5th)");
                            }
                            
                            // Update last TFT match ID
                            configService.updateSummonerLastTFTMatch(summoner.name, summoner.tagline, latestTFTMatchId);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing summoner ${summoner.name}:`, error);
                    // Continue with next summoner
                    continue;
                }
            }
        });
        
        console.log("Monitoring started");
    } catch (error) {
        console.error('Error during monitoring:', error);
    }
}

// Login to Discord
client.login(configService.loadConfig().discordToken).catch(error => {
    console.error('Failed to login:', error);
});

export { client }; 