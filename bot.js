const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config.js');

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
    console.log('getting PUUID')
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
        console.log(response.data[0])
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
        console.log(participants.length);
        for(i=0;i < participants.length; i++){
            console.log("Comparing ",PUUID," with ",participants[i]);
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
        details.push(info.participants[idNum].championName);
        details.push(info.participants[idNum].individualPosition);
        details.push(info.participants[idNum].win)

        return details

    } catch (error) {
        console.error('Error in extractDetails:', error);
    }
}

async function startMonitoring() {
    try{
        console.log("getting latest game ID")
        const summonerData = await getSummonerPUUID();
        const PUUID = summonerData.puuid;
        //console.log(PUUID)
        //cron.schedule('* * * * *', async () => {
            console.log("starting monitoring");
            
            const latestGameId = await getLatestGameId(PUUID);
            if (latestGameId  !== lastMatchId) {
                lastMatchId = latestGameId;
                const matchDetails = await getmatchDetails(latestGameId);
                details = await extractDetails(matchDetails, PUUID)
                console.log(details);
            }
    } catch (error) {
        console.error('Error during monitoring:', error);
    }
}

client.login(config.discordToken).catch(error => {
    console.error('Failed to login:', error);
});