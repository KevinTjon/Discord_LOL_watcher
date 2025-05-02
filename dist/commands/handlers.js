"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAddSummoner = handleAddSummoner;
exports.handleListSummoners = handleListSummoners;
exports.handleRemoveSummoner = handleRemoveSummoner;
exports.handleClearMessages = handleClearMessages;
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../config"));
const riotService_1 = __importDefault(require("../services/riotService"));
/**
 * Handle the /addsummoner slash command
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
async function handleAddSummoner(interaction) {
    await interaction.deferReply(); // Acknowledge the interaction immediately
    const riotId = interaction.options.getString('riot_id');
    const discordUser = interaction.options.getUser('discord_user');
    if (!riotId || !riotId.includes('#') || !discordUser) {
        await interaction.editReply('Please provide a valid Riot ID in the format "Name#Tagline" and select a Discord user.');
        return;
    }
    const [summonerName, tagline] = riotId.split('#');
    if (!summonerName || !tagline) {
        await interaction.editReply('Invalid Riot ID format. Please provide in the format "Name#Tagline".');
        return;
    }
    try {
        // Verify that the summoner exists before adding
        const summonerData = await riotService_1.default.getSummonerPUUID(summonerName, tagline);
        if (!summonerData) {
            await interaction.editReply(`Summoner ${summonerName}#${tagline} not found. Please check the name and tagline.`);
            return;
        }
        const added = config_1.default.addSummoner(summonerName, tagline, discordUser.id);
        if (added) {
            await interaction.editReply(`✅ Successfully added summoner **${summonerName}#${tagline}**! Notifications for losses will tag ${discordUser}.`);
        }
        else {
            await interaction.editReply(`⚠️ Summoner **${summonerName}#${tagline}** is already being tracked.`);
        }
    }
    catch (error) {
        console.error('Error adding summoner:', error);
        await interaction.editReply('An error occurred while adding the summoner. Please try again later.');
    }
}
/**
 * Handle the /listsummoners slash command
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
async function handleListSummoners(interaction) {
    await interaction.deferReply();
    try {
        const config = config_1.default.loadConfig();
        if (config.summoners.length === 0) {
            await interaction.editReply('No summoners are currently being tracked.');
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('Tracked Summoners')
            .setColor('#0099ff')
            .setDescription('List of all summoners currently being tracked')
            .setTimestamp();
        let summonersList = '';
        for (const summoner of config.summoners) {
            summonersList += `• **${summoner.name}#${summoner.tagline}** - <@${summoner.discordUsername}>\n`;
        }
        embed.addFields({ name: 'Summoners', value: summonersList });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error listing summoners:', error);
        await interaction.editReply('An error occurred while retrieving the summoner list.');
    }
}
/**
 * Handle the /removesummoner slash command
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
async function handleRemoveSummoner(interaction) {
    await interaction.deferReply();
    const riotId = interaction.options.getString('riot_id');
    if (!riotId || !riotId.includes('#')) {
        await interaction.editReply('Please provide a valid Riot ID in the format "Name#Tagline".');
        return;
    }
    const [summonerName, tagline] = riotId.split('#');
    if (!summonerName || !tagline) {
        await interaction.editReply('Invalid Riot ID format. Please provide in the format "Name#Tagline".');
        return;
    }
    try {
        const removed = config_1.default.removeSummoner(summonerName, tagline);
        if (removed) {
            await interaction.editReply(`✅ Successfully removed summoner **${summonerName}#${tagline}** from tracking.`);
        }
        else {
            await interaction.editReply(`❌ Summoner **${summonerName}#${tagline}** was not found in the tracking list.`);
        }
    }
    catch (error) {
        console.error('Error removing summoner:', error);
        await interaction.editReply('An error occurred while removing the summoner.');
    }
}
/**
 * Handle the /clearmessages slash command
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 */
async function handleClearMessages(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const channel = interaction.channel;
        if (!channel) {
            await interaction.editReply('Cannot access this channel.');
            return;
        }
        // First, inform the user that deletion has started
        await interaction.editReply('Starting to delete bot messages. This might take a while...');
        let messagesDeleted = 0;
        let lastMessageId = undefined;
        const batchSize = 100; // Discord API allows fetching max 100 messages at once
        // Loop until we can't fetch more messages
        while (true) {
            // Fetch messages in batches
            const options = { limit: batchSize };
            if (lastMessageId)
                options.before = lastMessageId;
            const messages = await channel.messages.fetch(options);
            if (messages.size === 0)
                break; // No more messages to check
            // Update the last message ID for pagination
            lastMessageId = messages.last()?.id;
            // Filter for bot messages
            const botMessages = messages.filter(msg => {
                return msg.author.id === interaction.client.user?.id;
            });
            if (botMessages.size === 0)
                continue; // No bot messages in this batch
            // Delete bot messages
            for (const [_, message] of botMessages) {
                try {
                    await message.delete();
                    messagesDeleted++;
                }
                catch (error) {
                    console.error(`Failed to delete message ${message.id}:`, error);
                    // Continue with other messages even if one fails
                }
            }
            // If we got fewer messages than the batch size, we've reached the end
            if (messages.size < batchSize)
                break;
        }
        // Final update
        await interaction.editReply(`✅ Successfully deleted ${messagesDeleted} bot messages from this channel.`);
    }
    catch (error) {
        console.error('Error clearing messages:', error);
        await interaction.editReply('An error occurred while deleting messages. Some messages may not have been deleted.');
    }
}
