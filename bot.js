/**
 * DEPRECATED: This file is kept for reference only.
 * Please use the TypeScript version in the src/ directory instead.
 * To run the TypeScript version:
 * 1. npm run build (to compile)
 * 2. node dist/index.js (to run)
 * 
 * This JavaScript version will not be maintained and may not work correctly.
 */

console.error('WARNING: You are using the deprecated JavaScript version of the bot.');
console.error('Please use the TypeScript version in the src/ directory instead.');
console.error('To run the TypeScript version:');
console.error('1. npm run build (to compile)');
console.error('2. node dist/index.js (to run)');
process.exit(1); // Exit with error code

const { Client, GatewayIntentBits, AttachmentBuilder, Attachment } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const configPath = './config.json';
let config = require(configPath);
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const getRandomMessage = require('./randomMessage');

// Set up fonts to support multiple languages including Chinese, Japanese, Korean
try {
    // On Windows systems, register common system fonts
    if (process.platform === 'win32') {
        // Try to register Arial Unicode MS which has good Unicode coverage
        registerFont('C:\\Windows\\Fonts\\arial.ttf', { family: 'Arial' });
        registerFont('C:\\Windows\\Fonts\\arialuni.ttf', { family: 'Arial Unicode MS' });
        console.log('Registered system fonts for multi-language support');
    } else if (process.platform === 'darwin') {
        // macOS paths
        registerFont('/System/Library/Fonts/Apple Color Emoji.ttc', { family: 'Apple Color Emoji' });
        registerFont('/System/Library/Fonts/PingFang.ttc', { family: 'PingFang' });
    } else {
        // Linux paths - adjust as needed
        registerFont('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', { family: 'Noto Sans CJK' });
    }
} catch (error) {
    console.error('Error registering fonts:', error.message);
    console.log('Will use default fonts which may not support all characters');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


let lastMatchId = null;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    startMonitoring();
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === '!addsummoner') {
        const input = args.join(' ');
        const [summonerInfo, discordUsername] = input.split(' ');
        
        if (!summonerInfo || !summonerInfo.includes('#') || !discordUsername) {
            return message.channel.send('Please provide input in the format "SummonerName#Tagline DiscordUsername".');
        }

        const [summonerName, tagline] = summonerInfo.split('#');
        if (!summonerName || !tagline) {
            return message.channel.send('Invalid summoner name format. Please provide in the format "SummonerName#Tagline".');
        }

        addSummoner(summonerName, tagline, discordUsername);
        message.channel.send(`Summoner ${summonerName}#${tagline} linked to ${discordUsername}.`);
    }

});

function addSummoner(summonerName, tagline, discordUsername) {
    const summonerExists = config.summoners.find(summoner => summoner.name === summonerName && summoner.tagline === tagline);
    if (!summonerExists) {
        config.summoners.push({ name: summonerName, tagline: tagline, discordUsername: discordUsername, lastMatchId: null });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`Summoner ${summonerName}#${tagline} linked to ${discordUsername} added to config.`);
    } else {
        console.log(`Summoner ${summonerName}#${tagline} already exists in config.`);
    }
}


async function getSummonerPUUID(summonerName, tagline) {
    try {
        console.log('Getting PUUID for', summonerName);
        
        // Properly encode the summoner name and tagline for API request
        const encodedName = encodeURIComponent(summonerName);
        const encodedTagline = encodeURIComponent(tagline);
        
        const response = await axios.get(`https://${config.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTagline}?api_key=${config.riotApiKey}`);
        return response.data;
    } catch (error) {
        console.error('Error in getSummonerPUUID:', error);
    }
}

async function getLatestGameId(PUUID) {
    try {
        const response = await axios.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${PUUID}/ids?start=0&count=20&api_key=${config.riotApiKey}`);
        if (response.data.length > 0) {
            //console.log(response.data[0]);
            return response.data[0];
        }
        return null;
    } catch (error) {
        console.error('Error in getLatestGameId:', error);
    }
}

async function getMatchDetails(matchID) {
    try {
        const response = await axios.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/${matchID}?api_key=${config.riotApiKey}`);
        //console.log(response);
        return response;
        
    } catch (error) {
        console.error('Error in getMatchDetails:', error);
    }
}

async function extractDetails(matchDetails, PUUID){
    try{
        const details = [];
        const participants = matchDetails.data.metadata.participants;
        const info = matchDetails.data.info;
        //console.log(participants);
        var idNum = null;
        //console.log(participants.length);
        for(i=0;i < participants.length; i++){
            //console.log("Comparing ",PUUID," with ",participants[i]);
            if(PUUID == participants[i]){
                idNum = i;
            }
        }

        if (idNum === null) {
            throw new Error('Summoner not found in match');
        }

        //console.log(idNum);
        // console.log(participants[idNum]);


        details.push(info.participants[idNum].riotIdGameName)
        details.push(info.queueId);
        details.push(info.participants[idNum].summonerId)
        details.push(info.participants[idNum].championId)
        details.push(info.participants[idNum].championName);
        details.push(info.participants[idNum].individualPosition);
        details.push(info.participants[idNum].win)
        
        const kills = info.participants[idNum].kills
        const deaths = info.participants[idNum].deaths
        const assists = info.participants[idNum].assists
        const kda = `${kills}/${deaths}/${assists}`;

        details.push(kda);



        return details

    } catch (error) {
        console.error('Error in extractDetails:', error);
    }
}
async function isranked(details,discordUsername){
    if(details[1] == 420 && details[6] != true){
        rankedData = await rankedinfo(details);
        console.log("did")
        const imageBuffer = await generateImage(details,rankedData);
        console.log("did2")
        const channel = client.channels.cache.get(config.discordChannelId);

        if(channel) {
            console.log("did3")
            await channel.send({
                content: `<@${discordUsername}>`,
                files: [imageBuffer]
            });
        } else {
            console.error('Channel not found.');
        }

    }
    else{
        console.log("New game found was either not ranked or a win");
    }

}

async function rankedinfo(details){
    const rankedinfo = [];

    try{
        const response = await axios.get(`https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${details[2]}?api_key=${config.riotApiKey}`,
        {});

        console.log(response);
        //console.log(response.data[0].tier);
        if(response.data.length === 0){
            console.log("ranked info is empty");
            rankedinfo.push("UNRANKED");
            rankedinfo.push(" ");
            rankedinfo.push(0); // Default LP value for unranked
            rankedinfo.push(undefined); // No LP loss for unranked
        }
        else{
            const tier = response.data[0].tier;
            const rank = response.data[0].rank;
            const currentLP = response.data[0].leaguePoints;
            
            rankedinfo.push(tier);
            rankedinfo.push(rank);
            rankedinfo.push(currentLP);
            
            // Check if we have previous LP data stored
            try {
                const fs = require('fs');
                const path = require('path');
                const dataPath = path.join(__dirname, 'data', 'storage.json');
                
                if (fs.existsSync(dataPath)) {
                    const storageData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
                    const summonerId = details[2];
                    
                    if (storageData.playerRanks && storageData.playerRanks[summonerId]) {
                        const previousData = storageData.playerRanks[summonerId];
                        
                        // Handle high elo tiers without divisions (MASTER, GRANDMASTER, CHALLENGER)
                        const highEloTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
                        
                        // If same tier in high elo, just compare LP
                        if (previousData.tier === tier && highEloTiers.includes(tier)) {
                            if (currentLP < previousData.leaguePoints) {
                                rankedinfo.push(previousData.leaguePoints - currentLP);
                            } else {
                                rankedinfo.push(undefined); // No LP loss to display
                            }
                        }
                        // Demotions between high elo tiers (Challenger → Grandmaster → Master)
                        else if (highEloTiers.includes(previousData.tier) && highEloTiers.includes(tier) && 
                                isTierDemotion(previousData.tier, tier)) {
                            // Use the same LP loss calculation for high ELO tier demotions
                            // LP loss is simply the difference between previous and current LP
                            rankedinfo.push(previousData.leaguePoints - currentLP);
                        }
                        // Only calculate LP loss if still in the same tier and rank
                        else if (previousData.tier === tier && previousData.rank === rank) {
                            // If currentLP is less than previous LP, it's a loss
                            if (currentLP < previousData.leaguePoints) {
                                rankedinfo.push(previousData.leaguePoints - currentLP);
                            } else {
                                rankedinfo.push(undefined); // No LP loss to display
                            }
                        } 
                        // Handle tier demotion cases
                        else if (
                            // Diamond 4 -> Emerald 1
                            (previousData.tier === 'DIAMOND' && previousData.rank === 'IV' && 
                            tier === 'EMERALD' && rank === 'I') ||
                            // Other tier demotions (general case)
                            (isTierDemotion(previousData.tier, tier) && rank === 'I')
                        ) {
                            // For tier demotions, use a fixed LP loss value
                            rankedinfo.push(25); // Standard LP loss for tier demotions
                        }
                        // Handle division demotion cases (within the same tier)
                        else if (previousData.tier === tier && isDivisionDemotion(previousData.rank, rank)) {
                            // For division demotions, calculate LP loss: previous LP + (100 - current LP)
                            // Example: Diamond 1 (2 LP) → Diamond 2 (82 LP) = 2 + (100 - 82) = 20 LP loss
                            rankedinfo.push(previousData.leaguePoints + (100 - currentLP));
                        } else {
                            rankedinfo.push(undefined); // Tier/rank changed, no LP loss
                        }
                    } else {
                        rankedinfo.push(undefined); // No previous data for this player
                    }
                    
                    // Update the storage with current data
                    if (!storageData.playerRanks) {
                        storageData.playerRanks = {};
                    }
                    
                    storageData.playerRanks[summonerId] = {
                        summonerId,
                        tier,
                        rank,
                        leaguePoints: currentLP,
                        lastUpdated: Date.now()
                    };
                    
                    // Create data directory if it doesn't exist
                    const dataDir = path.join(__dirname, 'data');
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    
                    fs.writeFileSync(dataPath, JSON.stringify(storageData, null, 2), 'utf-8');
                } else {
                    // Create initial storage file
                    const dataDir = path.join(__dirname, 'data');
                    if (!fs.existsSync(dataDir)) {
                        fs.mkdirSync(dataDir, { recursive: true });
                    }
                    
                    const initialData = {
                        playerRanks: {
                            [summonerId]: {
                                summonerId,
                                tier,
                                rank,
                                leaguePoints: currentLP,
                                lastUpdated: Date.now()
                            }
                        }
                    };
                    
                    fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2), 'utf-8');
                    rankedinfo.push(undefined); // No previous data for comparison
                }
            } catch (storageError) {
                console.error('Error handling LP storage:', storageError);
                rankedinfo.push(undefined); // Error occurred, no LP loss to display
            }
        }

        return rankedinfo;
    } catch (error){
        console.error('Error fetching ranked info:', error);
        return null;
    }
}

async function startMonitoring() {
    try{
        cron.schedule('* * * * *', async () => {

            for (const summoner of config.summoners) {
                   
                    console.log("Getting latest game ID for", summoner.name);
                    const summonerData = await getSummonerPUUID(summoner.name,summoner.tagline);
                    const PUUID = summonerData.puuid;
                    
                    console.log("starting monitoring");
                    
                    const latestGameId = await getLatestGameId(PUUID);
                    console.log(latestGameId);
                    if (latestGameId  !== summoner.lastMatchId) {
                        const matchDetails = await getMatchDetails(latestGameId);
                        details = await extractDetails(matchDetails, PUUID)
                        console.log(details);

                        await isranked(details,summoner.discordUsername);

                        summoner.lastMatchId = latestGameId;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                    
                        //console.log(details);
                        
                        

                
                    //console.log(details);
                    }

            }
        });
    } catch (error) {
        console.error('Error during monitoring:', error);
    }
}

client.login(config.discordToken).catch(error => {
    console.error('Failed to login:', error);
});

async function generateImage(details, rankedData){
    const canvas = createCanvas(800, 240);
    const ctx = canvas.getContext('2d');

    // Load background image
    const background = await loadImage(path.join(__dirname, 'assets', 'background', 'background.jpg'));
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    const defeat = await loadImage(path.join(__dirname, 'assets', 'background', `Defeat.png`));
    ctx.drawImage(defeat, 475, -50, 300, 300);

    // Load champion icon using Riot Dragon API
    try {
        // Use Dragon API for champion image
        const championImage = await loadImage(`http://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${details[4]}.png`);
        ctx.drawImage(championImage, 25, 25, 75, 75);
    } catch (error) {
        console.error(`Champion icon not found from Dragon API for ${details[4]}`);
        // Fallback to local files if Dragon API fails
        try {
            const championImage = await loadImage(path.join(__dirname, 'assets', 'champion_icons', `${details[3]}.png`));
            ctx.drawImage(championImage, 25, 25, 75, 75);
        } catch (innerError) {
            console.error(`Local champion icon not found for ${details[4]} either`);
        }
    }

    // Load ranked icon
    try {
        const summonerRank = await loadImage(path.join(__dirname, 'assets', 'ranked_icons', `${rankedData[0]}.png`));
        ctx.drawImage(summonerRank, 25, 135, 75, 75);
    } catch (error) {
        console.error(`Ranked icon not found for ${rankedData[0]}`);
    }
    
    // Draw text without labels
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px "Arial Unicode MS", Arial, sans-serif';
    
    // Get the summoner name and handle any special cases
    let SummonerName = details[0];
    // Check if name exists and isn't null/undefined before trying to display it
    if (!SummonerName) {
        SummonerName = "Unknown Player";
        console.log("Warning: Summoner name is null or undefined");
    } else if (SummonerName.localeCompare("我恨你婊子") === 0) {
        SummonerName = "Zou's chinese account";
    }
    // Ensure SummonerName is properly encoded for display
    try {
        // Check if the summoner name has non-ASCII characters
        if (/[^\u0000-\u007f]/.test(SummonerName)) {
            console.log(`Handling non-ASCII summoner name: ${SummonerName}`);
        }
        
        // Summoner name (no label)
        ctx.fillText(SummonerName, 110, 50);
    } catch (error) {
        console.error(`Error displaying summoner name: ${error.message}`);
        // Fallback to a placeholder if the name can't be displayed
        ctx.fillText("Player Name", 110, 50);
    }
    
    // Champion name (no label)
    ctx.fillText(details[4], 110, 80);
    
    // KDA (no label)
    ctx.fillText(details[7], 110, 110);
    
    // Rank (no label)
    ctx.fillText(`${rankedData[0]} ${rankedData[1]}`, 110, 170);
    
    // Add LP loss graphic with the actual LP value
    ctx.fillStyle = '#ff4d4d'; // Red color for LP loss
    ctx.font = 'bold 20px "Arial Unicode MS", Arial, sans-serif';
    
    // Only show LP loss if we have the data
    if (rankedData[3] !== undefined) {
        ctx.fillText(`-${rankedData[3]}LP`, 220, 170);
    }
    
    // Position (no label)
    const position = details[5] === 'UTILITY' ? 'SUPPORT' : details[5];
    ctx.fillText(position, 400, 50);

    // Add random taunt message
    const randomMessage = getRandomMessage('league');
    ctx.font = 'bold 18px "Arial Unicode MS", Arial, sans-serif';
    drawCenteredText(ctx, randomMessage, canvas.width / 2, 200, 500);

    // Return the image as a buffer
    return canvas.toBuffer();
}

function drawCenteredText(ctx, text, x, y, maxWidth) {
    // Measure the width of the text
    const textWidth = ctx.measureText(text).width;
    
    // Calculate the x-coordinate to center the text
    const centerX = x - (textWidth / 2);
    
    // Draw the text at the calculated position
    ctx.fillText(text, centerX, y);
}

// Helper function to check tier demotions
function isTierDemotion(previousTier, currentTier) {
    const tierOrder = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'IRON'];
    
    const previousIndex = tierOrder.indexOf(previousTier);
    const currentIndex = tierOrder.indexOf(currentTier);
    
    // If current tier is lower in the list (higher index), it's a demotion
    return previousIndex < currentIndex;
}

// Helper function to check division demotions
function isDivisionDemotion(previousRank, currentRank) {
    // For tiers without divisions (MASTER, GRANDMASTER, CHALLENGER)
    // these values shouldn't even be compared
    if (previousRank === '' || currentRank === '') {
        return false;
    }
    
    const rankOrder = ['I', 'II', 'III', 'IV'];
    
    const previousIndex = rankOrder.indexOf(previousRank);
    const currentIndex = rankOrder.indexOf(currentRank);
    
    // If current rank is lower in the list (higher index), it's a demotion
    return previousIndex < currentIndex;
}
