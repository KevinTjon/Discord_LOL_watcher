"use strict";
/**
 * HateWatcher Bot - Entry Point
 *
 * A Discord bot that monitors League of Legends players' ranked games
 * and notifies when they lose a ranked match.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the bot client
const bot_1 = require("./bot");
/**
 * Handle process termination signals
 */
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    bot_1.client.destroy();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    bot_1.client.destroy();
    process.exit(0);
});
// Log uncaught exceptions to help with debugging
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
console.log('HateWatcher bot is starting...');
