"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const discord_js_1 = require("discord.js");
// Define commands
exports.commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName('addsummoner')
        .setDescription('Add a summoner to track their ranked losses')
        .addStringOption(option => option.setName('riot_id')
        .setDescription('The summoner\'s Riot ID in format "Name#Tagline"')
        .setRequired(true))
        .addUserOption(option => option.setName('discord_user')
        .setDescription('The Discord user to tag when this summoner loses')
        .setRequired(true)),
    new discord_js_1.SlashCommandBuilder()
        .setName('listsummoners')
        .setDescription('List all summoners being tracked'),
    new discord_js_1.SlashCommandBuilder()
        .setName('removesummoner')
        .setDescription('Remove a summoner from tracking')
        .addStringOption(option => option.setName('riot_id')
        .setDescription('The summoner\'s Riot ID in format "Name#Tagline"')
        .setRequired(true)),
    new discord_js_1.SlashCommandBuilder()
        .setName('clearmessages')
        .setDescription('Delete all messages from the bot in the current channel')
];
