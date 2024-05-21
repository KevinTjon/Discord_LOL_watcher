const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config.js');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const getRandomMessage = require('./randomMessage');

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

    if (message.content.startsWith('!latestgame')) {
        try {
            const latestGame = await getLatestGame();
            if (latestGame) {
                message.channel.send(`Latest Game: ${JSON.stringify(latestGame, null, 2)}`);
            } else {
                message.channel.send('No recent games found.');
            }
        } catch (error) {
            message.channel.send('Error fetching game data.');
            console.error(error);
        }
    }
});

async function getSummonerPUUID() {
    try{
    //console.log('getting PUUID')
    const response = await axios.get(`https://${config.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${config.summonerName}/${config.tagline}?api_key=${config.riotApiKey}`, {
    });
    //console.log(response);
    return response.data;
    } catch(error){
        console.error('Error in getSummonerPUUID:', error);
    }
}

async function getLatestGameId(PUUID) {

    try{
    const response = await axios.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${PUUID}/ids?start=0&count=20&api_key=${config.riotApiKey}`, {
    });
    //console.log(response.data)
    if (response.data.length > 0) {
        //console.log(response.data[0])
        return response.data[0];
    }
    return null;
    } catch (error){
        console.error('Error in getLatestGameId:', error);
    }
}

async function getmatchDetails(matchID){
    try{
        const response = await axios.get(`https://${config.region}.api.riotgames.com/lol/match/v5/matches/${matchID}?api_key=${config.riotApiKey}`,
        {});
        //console.log(response);
        return response;
    } catch (error) {
        console.error('Error in getmatchDetails:', error);
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

async function isranked(details){
    if(details[1] == 420 && details[6] != true){

        rankedData = await rankedinfo(details);

        const imageBuffer = await generateImage(details,rankedData);

        const channel = client.channels.cache.get(config.discordChannelId);

        if(channel) {
            const attachment = new AttachmentBuilder(imageBuffer, {name: 'game-details.png'});
            channel.send({ files: [attachment] });
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
    const response = await axios.get(`https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${details[2]}?api_key=${config.riotApiKey}`,
    {});

    //console.log(response);
    console.log(response.data[0].tier);

    rankedinfo.push(response.data[0].tier);
    rankedinfo.push(response.data[0].rank);

    return rankedinfo;
}

async function startMonitoring() {
    try{
        console.log("getting latest game ID")
        const summonerData = await getSummonerPUUID();
        const PUUID = summonerData.puuid;
        //console.log(PUUID)
        cron.schedule('* * * * *', async () => {
            console.log("starting monitoring");
            
            const latestGameId = await getLatestGameId(PUUID);
            if (latestGameId  !== lastMatchId) {
                lastMatchId = latestGameId;
                const matchDetails = await getmatchDetails(latestGameId);
                details = await extractDetails(matchDetails, PUUID)
                //console.log(details);
                
                await isranked(details);

        
            //console.log(details);
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
    const canvas = createCanvas(800,240);
    const ctx = canvas.getContext('2d');

    // Load background image
    const background = await loadImage(path.join(__dirname, 'assets', 'background', 'background.jpg'));
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    const defeat = await loadImage(path.join(__dirname, 'assets', 'background', `Defeat.png`));
    ctx.drawImage(defeat, 475, -50, 300, 300);
    
    const summonerRank = await loadImage(path.join(__dirname, 'assets', 'ranked_icons', `${rankedData[0]}.png`));
    const rankImageWidth = 200; // Adjust as needed
    const rankImageHeight = 200; // Adjust as needed
    ctx.drawImage(summonerRank, 0, 0, rankImageWidth, rankImageHeight);
    

    ctx.font = '20px Sans'; // Set the font size and family
    ctx.fillStyle = '#FFFFFF'; // Set the text color
    // Draw text to display summoner rank and tier
    const summonerRankText = rankedData[0];
    const summonerTierText = rankedData[1];
    const SummonerName = details[0];

    const textX = 45; // Adjust as needed
    const textY = 201; // Adjust as needed
    ctx.fillText(summonerRankText, textX, textY-10);
    ctx.fillText(summonerTierText, textX+100, textY-10 );
    ctx.fillText(SummonerName, textX+30, textY+20 );
    

    // Load and draw champion image
    const championName = details[4];
    const championImage = await loadImage(path.join(__dirname, 'assets', 'champion_icons', `${details[3]}.png`));
    ctx.drawImage(championImage, 250, 75, 75, 75);
    ctx.fillText(championName, 250+100, 110);
    ctx.fillText(details[7], 250+100, 135);

    const randomMessage = getRandomMessage();
    drawCenteredText(ctx, randomMessage, 300, 200, 200);

    // Return the image as a buffer
    return canvas.toBuffer();
}

function drawCenteredText(ctx, text, x, y, maxWidth) {
    // Measure the width of the text
    const textWidth = ctx.measureText(text).width;
    
    // Calculate the x-coordinate to center the text
    const centerX = x + (maxWidth - textWidth) / 2;
    
    // Draw the text at the calculated position
    ctx.fillText(text, centerX, y);
}
