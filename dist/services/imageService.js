"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImage = generateImage;
exports.drawCenteredText = drawCenteredText;
exports.getTauntMessage = getTauntMessage;
const canvas_1 = require("canvas");
const path_1 = __importDefault(require("path"));
const randomMessage_1 = __importDefault(require("../randomMessage"));
// Register fonts to support multi-language characters including CJK
try {
    // Windows system
    if (process.platform === 'win32') {
        (0, canvas_1.registerFont)('C:\\Windows\\Fonts\\arial.ttf', { family: 'Arial' });
        (0, canvas_1.registerFont)('C:\\Windows\\Fonts\\arialuni.ttf', { family: 'Arial Unicode MS' });
        console.log('Registered fonts for multi-language support on Windows');
    }
    else if (process.platform === 'darwin') {
        // macOS paths
        (0, canvas_1.registerFont)('/System/Library/Fonts/Apple Color Emoji.ttc', { family: 'Apple Color Emoji' });
        (0, canvas_1.registerFont)('/System/Library/Fonts/PingFang.ttc', { family: 'PingFang' });
        console.log('Registered fonts for multi-language support on macOS');
    }
    else {
        // Linux paths - adjust as needed
        (0, canvas_1.registerFont)('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', { family: 'Noto Sans CJK' });
        console.log('Registered fonts for multi-language support on Linux');
    }
}
catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error registering fonts for multi-language support:', errorMessage);
    console.log('Will use default fonts which may not support all characters');
}
/**
 * Generate an image for a match
 * @param {string[]} details Match details
 * @param {RankedData} rankedData Ranked data
 * @returns {Promise<Buffer>} Image buffer
 */
async function generateImage(details, rankedData) {
    // Create wider canvas for a cleaner look
    const canvas = (0, canvas_1.createCanvas)(900, 250);
    const ctx = canvas.getContext('2d');
    try {
        // Dark gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Add some subtle design elements
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.arc(750, 50, 200, 0, Math.PI * 2);
        ctx.fill();
        // Red accent for defeat
        ctx.fillStyle = '#b1272e';
        ctx.fillRect(0, 0, 5, canvas.height);
        // Load champion icon from Riot Dragon API
        try {
            // Use Dragon API for champion image
            const championIcon = await (0, canvas_1.loadImage)(`http://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/${details[4]}.png`);
            // Draw circular frame for champion icon
            ctx.save();
            ctx.beginPath();
            ctx.arc(80, 80, 50, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(championIcon, 30, 30, 100, 100);
            ctx.restore();
            // Add circle border
            ctx.strokeStyle = '#b1272e';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(80, 80, 50, 0, Math.PI * 2);
            ctx.stroke();
        }
        catch (error) {
            console.error(`Champion icon not found from Dragon API for ${details[4]}`);
            // Fallback to local files if Dragon API fails
            try {
                const championIcon = await (0, canvas_1.loadImage)(path_1.default.join(__dirname, '../..', 'assets', 'champion_icons', `${details[4]}.png`));
                // Draw circular frame for champion icon
                ctx.save();
                ctx.beginPath();
                ctx.arc(80, 80, 50, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(championIcon, 30, 30, 100, 100);
                ctx.restore();
                // Add circle border
                ctx.strokeStyle = '#b1272e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(80, 80, 50, 0, Math.PI * 2);
                ctx.stroke();
            }
            catch (innerError) {
                console.error(`Local champion icon not found for ${details[4]} either`);
            }
        }
        // Draw a nice sized DEFEAT image on the right
        try {
            const defeat = await (0, canvas_1.loadImage)(path_1.default.join(__dirname, '../..', 'assets', 'background', 'Defeat.png'));
            // Use larger scaling factor for the DEFEAT image
            const imgWidth = defeat.width;
            const imgHeight = defeat.height;
            const scale = Math.min(450 / imgWidth, 300 / imgHeight);
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            // Position it more to the left
            const xPos = canvas.width - scaledWidth; // Remove the +50 to move it left
            const yPos = (canvas.height - scaledHeight) / 2;
            // Draw with larger proportions
            ctx.drawImage(defeat, xPos, yPos, scaledWidth, scaledHeight);
        }
        catch (error) {
            // Fallback if image not found
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = '#b1272e';
            ctx.fillText('DEFEAT', canvas.width - 300, 125);
        }
        // Summoner name
        ctx.font = 'bold 22px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        // Safely render summoner name with proper error handling for non-Latin characters
        try {
            // Check if the summoner name contains non-ASCII characters
            if (/[^\u0000-\u007f]/.test(details[0])) {
                console.log(`Rendering non-ASCII summoner name: ${details[0]}`);
            }
            // Handle special case for Chinese account
            let summonerName = details[0];
            if (summonerName === "我恨你婊子") {
                summonerName = "Zou's chinese account";
                console.log("Converted Chinese account name to readable form");
            }
            ctx.fillText(summonerName, 160, 50);
        }
        catch (error) {
            console.error(`Error rendering summoner name: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Fallback to a placeholder if the name can't be rendered
            ctx.fillText("Player Name", 160, 50);
        }
        // Position with colored badge
        const position = details[5] === 'UTILITY' ? 'SUPPORT' : details[5];
        ctx.fillStyle = '#3a506b';
        ctx.fillRect(160, 60, ctx.measureText(position).width + 20, 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillText(position, 170, 78);
        // Champion name
        ctx.font = '18px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#e2e2e2';
        ctx.fillText(details[4], 160, 110);
        // KDA stylized
        const kdaParts = details[7].split('/');
        const kills = parseInt(kdaParts[0]);
        const deaths = parseInt(kdaParts[1]);
        const assists = parseInt(kdaParts[2]);
        ctx.font = 'bold 20px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#4ecca3'; // Green for kills
        ctx.fillText(kills.toString(), 160, 145);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '20px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillText(' / ', 160 + ctx.measureText(kills.toString()).width, 145);
        ctx.font = 'bold 20px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#ff6b6b'; // Red for deaths
        const slashWidth = ctx.measureText(' / ').width;
        ctx.fillText(deaths.toString(), 160 + ctx.measureText(kills.toString()).width + slashWidth, 145);
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '20px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillText(' / ', 160 + ctx.measureText(kills.toString()).width + slashWidth + ctx.measureText(deaths.toString()).width, 145);
        ctx.font = 'bold 20px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#46b3e6'; // Blue for assists
        const secondSlashX = 160 + ctx.measureText(kills.toString()).width + slashWidth + ctx.measureText(deaths.toString()).width + slashWidth;
        ctx.fillText(assists.toString(), secondSlashX, 145);
        // Draw ranked info
        try {
            const rankedIcon = await (0, canvas_1.loadImage)(path_1.default.join(__dirname, '../..', 'assets', 'ranked_icons', `${rankedData.tier}.png`));
            ctx.drawImage(rankedIcon, 65, 150, 60, 60);
            // Rank text next to icon
            ctx.font = 'bold 18px "Arial Unicode MS", Arial, sans-serif';
            ctx.fillStyle = '#e2e2e2';
            ctx.fillText(`${rankedData.tier} ${rankedData.rank}`, 140, 190);
            // Add LP loss indicator
            ctx.fillStyle = '#ff4d4d'; // Red color for LP loss
            ctx.font = 'bold 18px "Arial Unicode MS", Arial, sans-serif';
            const rankWidth = ctx.measureText(`${rankedData.tier} ${rankedData.rank}`).width;
            // Only show LP loss if we have the data
            if (rankedData.lpLoss !== undefined) {
                ctx.fillText(`-${rankedData.lpLoss}LP`, 145 + rankWidth, 190);
            }
        }
        catch (error) {
            console.error(`Ranked icon not found for ${rankedData.tier}`);
            // Just show text if icon not found
            ctx.font = 'bold 18px "Arial Unicode MS", Arial, sans-serif';
            ctx.fillStyle = '#e2e2e2';
            ctx.fillText(`${rankedData.tier} ${rankedData.rank}`, 70, 190);
            // Add LP loss indicator
            ctx.fillStyle = '#ff4d4d'; // Red color for LP loss
            ctx.font = 'bold 18px "Arial Unicode MS", Arial, sans-serif';
            const rankWidth = ctx.measureText(`${rankedData.tier} ${rankedData.rank}`).width;
            // Only show LP loss if we have the data
            if (rankedData.lpLoss !== undefined) {
                ctx.fillText(`-${rankedData.lpLoss}LP`, 75 + rankWidth, 190);
            }
        }
        // Add random taunt message with nice styling
        const tauntMessage = (0, randomMessage_1.default)('league');
        ctx.font = 'italic bold 18px "Arial Unicode MS", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        // Add a subtle background for the taunt message
        const tauntWidth = ctx.measureText(tauntMessage).width;
        ctx.fillStyle = 'rgba(30, 30, 60, 0.6)';
        ctx.fillRect(canvas.width / 2 - tauntWidth / 2 - 15, 215, tauntWidth + 30, 30);
        // Draw the taunt message
        ctx.fillStyle = '#ffffff';
        drawCenteredText(ctx, tauntMessage, canvas.width / 2, 235, 600);
        return canvas.toBuffer();
    }
    catch (error) {
        console.error('Error generating image:', error);
        // Generate a simple fallback image
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText(details[0], 50, 50);
        ctx.fillText(details[4], 50, 80);
        ctx.fillText(details[7], 50, 110);
        ctx.fillText(`${rankedData.tier} ${rankedData.rank}`, 50, 140);
        ctx.fillText(`DEFEAT`, 50, 170);
        return canvas.toBuffer();
    }
}
/**
 * Draw centered text with support for Unicode characters
 * @param {CanvasRenderingContext2D} ctx Canvas context
 * @param {string} text Text to draw
 * @param {number} x X position
 * @param {number} y Y position
 * @param {number} maxWidth Maximum width
 */
function drawCenteredText(ctx, text, x, y, maxWidth) {
    try {
        // Check if text contains non-ASCII characters
        if (text && /[^\u0000-\u007f]/.test(text)) {
            console.log(`Rendering centered non-ASCII text: ${text}`);
        }
        // Measure text width to calculate center position
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const startX = x - (textWidth / 2);
        // Draw the text
        ctx.fillText(text, startX, y, maxWidth);
    }
    catch (error) {
        console.error(`Error rendering centered text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Fallback to a simple centered method
        ctx.fillText('Error displaying message', x - 100, y, maxWidth);
    }
}
/**
 * Get image without additional text message
 * @param {string} discordUsername Discord username
 * @param {Buffer} imageBuffer Image buffer
 * @returns {{ content: string, files: Buffer[] }} Message content
 */
function getTauntMessage(discordUsername, imageBuffer) {
    return {
        content: `<@${discordUsername}>`, // Only mention the user, no taunt message
        files: [imageBuffer]
    };
}
exports.default = {
    generateImage,
    drawCenteredText,
    getTauntMessage
};
