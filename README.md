# HateWatcher

A Discord bot that monitors League of Legends and Teamfight Tactics (TFT) players' ranked games and notifies a Discord channel when they lose a ranked match.

## Features

- Tracks multiple summoners listed in config.json
- Monitors both League of Legends and Teamfight Tactics ranked games
- Checks for new matches every minute using cron jobs
- Generates custom images with game data:
  - For League: champion played, KDA, and rank info
  - For TFT: placement, level, and rank info
- Only triggers notifications for ranked losses (not wins or non-ranked games)
  - For League: losses in ranked queue 420
  - For TFT: placements 5th-8th in ranked queue 1100
- Includes Discord slash commands for easily managing tracked summoners:
  - `/addsummoner` - Add a new summoner to track
  - `/listsummoners` - View all currently tracked summoners
  - `/removesummoner` - Remove a summoner from tracking
- Legacy command support with `!addsummoner` for backward compatibility

## Technical Improvements

- Converted codebase to TypeScript for better type safety and maintainability
- Implemented Discord slash commands for improved user experience
- Implemented modular architecture with services and clear separation of concerns
- Added caching to reduce API calls
- Added error handling and graceful shutdown
- Used environment variables for sensitive information
- Added better validation and error logging

## Requirements

- Node.js 16+ 
- npm or yarn
- Discord Bot Token
- Riot Games API Key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/hatewatcher.git
cd hatewatcher
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Discord and Riot API tokens:
```
# Bot Configuration
RIOT_API_KEY=your_riot_api_key_here
DISCORD_TOKEN=your_discord_token_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here
TFT_DISCORD_CHANNEL_ID=your_tft_discord_channel_id_here (optional)
REGION=americas
```

4. Build the TypeScript files:
```bash
npm run build
```

5. Start the bot:
```bash
npm start
```

## Usage

### Discord Slash Commands

The bot supports the following slash commands:

- `/addsummoner riot_id:<n>#<Tagline> discord_user:@User` - Add a new summoner to track
- `/listsummoners` - List all currently tracked summoners
- `/removesummoner riot_id:<n>#<Tagline>` - Remove a summoner from tracking

### Legacy Command

For backward compatibility, the bot still supports the old command format:

- `!addsummoner <SummonerName>#<Tagline> <DiscordUserId>` - Add a new summoner to track

## Configuration

You can use either the `.env` file or the `config.json` file to configure the bot. Here's a sample config.json:

```json
{
  "summoners": [
    {
      "name": "SummonerName",
      "tagline": "tagline",
      "discordUsername": "discordUsername",
      "lastMatchId": null,
      "lastTFTMatchId": null
    }
  ],
  "region": "americas",
  "riotApiKey": "RIOT API KEY",
  "discordToken": "DISCORD TOKEN KEY",
  "discordChannelId": "DISCORD CHANNEL ID",
  "tftDiscordChannelId": "TFT DISCORD CHANNEL ID (OPTIONAL)",
  "guildId": "GUILD ID (OPTIONAL - FOR COMMAND REGISTRATION)"
}
```

If `tftDiscordChannelId` is not specified, TFT loss notifications will be sent to the main Discord channel (discordChannelId).

## Development

- `npm run build` - Build the TypeScript files
- `npm run dev` - Run in development mode with hot reloading
- `npm start` - Start the bot
- `npm run lint` - Run ESLint

## Directory Structure

- `src/` - Source code
  - `commands/` - Discord slash command definitions and handlers
  - `services/` - Service modules
  - `types/` - TypeScript type definitions
- `assets/` - Image assets
  - `background/` - Background images
  - `champion_icons/` - Champion icons
  - `ranked_icons/` - Ranked emblems
- `data/` - Storage for rank data

## License

MIT 

## Deployment on Render.com

You can deploy this bot for free on Render.com:

1. Push your code to a GitHub repository.

2. Sign up for an account at [Render.com](https://render.com).

3. From the Render dashboard, click "New" and select "Web Service".

4. Connect your GitHub account and select your repository.

5. Configure your service:
   - Name: `hatewatcher-bot` (or any name you prefer)
   - Environment: `Docker`
   - Branch: `main` (or your preferred branch)
   - Plan: `Free`

6. Add the following environment variables:
   - `REGION`: americas (or your preferred region)
   - `RIOT_API_KEY`: Your Riot API key
   - `DISCORD_TOKEN`: Your Discord bot token
   - `DISCORD_CHANNEL_ID`: Your Discord channel ID
   - `TFT_DISCORD_CHANNEL_ID`: (Optional) Your TFT Discord channel ID
   - `GUILD_ID`: (Optional) Your Discord server ID

7. Click "Create Web Service" and Render will automatically deploy your bot.

Note: On the free tier, Render will spin down your service after 15 minutes of inactivity. The first request after inactivity may take a few seconds to respond while the service spins up again. However, since your bot is making regular API calls, it should stay active. 