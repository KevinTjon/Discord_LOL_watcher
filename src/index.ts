/**
 * HateWatcher Bot - Entry Point
 * 
 * A Discord bot that monitors League of Legends players' ranked games
 * and notifies when they lose a ranked match.
 */

// Import the bot client
import { client } from './bot';

/**
 * Handle process termination signals
 */
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  client.destroy();
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