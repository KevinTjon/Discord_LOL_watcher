import { createCanvas, loadImage, Image, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';
import { MessageCreateOptions, AttachmentBuilder } from 'discord.js';
import path from 'path';
import axios from 'axios';
import { TFTMatchDetails, TFTRankedData, TFTTrait, TFTUnit } from '../types';
import getRandomMessage from '../randomMessage';

// Cache for downloaded images
const imageCache: Record<string, Buffer> = {};

// Cache for TFT metadata
const metadataCache: Record<string, any> = {};

// Current patch version - should be updated periodically
const CURRENT_PATCH = "15.9.1";

/**
 * Fetch TFT metadata from Data Dragon
 * @param {string} type Type of metadata (champion, trait, etc.)
 * @returns {Promise<any>} Metadata object
 */
async function fetchTFTMetadata(type: string): Promise<any> {
    // Check cache first
    if (metadataCache[type]) {
        return metadataCache[type];
    }

    try {
        // Fetch the metadata from Data Dragon
        const response = await axios.get(
            `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/data/en_US/tft-${type}.json`
        );

        // Cache the response
        metadataCache[type] = response.data;
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch TFT ${type} metadata:`, error);
        return null;
    }
}

/**
 * Get TFT champion info from metadata
 * @param {string} championId Champion ID
 * @returns {Promise<any>} Champion info
 */
async function getTFTChampionInfo(championId: string): Promise<any> {
    const metadata = await fetchTFTMetadata('champion');
    if (!metadata) return null;

    // Clean the championId by removing prefixes
    let cleanId = championId;
    if (!championId.startsWith('TFT')) {
        cleanId = `TFT9_${championId}`;
    }

    // Check if the champion exists in the metadata
    if (metadata.data[cleanId]) {
        return metadata.data[cleanId];
    }

    // If not found with exact ID, try to find by partial match
    const possibleIds = Object.keys(metadata.data).filter(id => 
        id.includes(cleanId) || cleanId.includes(id.replace('TFT9_', ''))
    );

    if (possibleIds.length > 0) {
        return metadata.data[possibleIds[0]];
    }

    return null;
}

/**
 * Get TFT trait info from metadata
 * @param {string} traitId Trait ID
 * @returns {Promise<any>} Trait info
 */
async function getTFTTraitInfo(traitId: string): Promise<any> {
    const metadata = await fetchTFTMetadata('trait');
    if (!metadata) return null;

    // Clean the traitId by removing prefixes and path
    let cleanId = traitId;
    if (cleanId.includes('/')) {
        cleanId = cleanId.split('/').pop() || '';
    }
    
    cleanId = cleanId.replace(/^Set\d+_/, '').replace(/^TFT\d+_/, '');

    // Check if the trait exists in the metadata
    const possibleIds = Object.keys(metadata.data).filter(id => {
        const normalizedId = id.replace(/^Set\d+_/, '').replace(/^TFT\d+_/, '');
        return normalizedId.toLowerCase() === cleanId.toLowerCase() || 
               id.toLowerCase().includes(cleanId.toLowerCase()) ||
               normalizedId.toLowerCase().includes(cleanId.toLowerCase());
    });

    if (possibleIds.length > 0) {
        return metadata.data[possibleIds[0]];
    }

    return null;
}

/**
 * Fetch a sprite image from Data Dragon
 * @param {string} spritePath Sprite path
 * @returns {Promise<Image>} Sprite image
 */
async function fetchSpriteImage(spritePath: string): Promise<Image> {
    try {
        const cacheKey = `sprite_${spritePath}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Fetch the sprite image
        const response = await axios.get(
            `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/${spritePath}`,
            { responseType: 'arraybuffer' }
        );
        
        const buffer = Buffer.from(response.data);
        imageCache[cacheKey] = buffer;
        
        return await loadImage(buffer);
    } catch (error) {
        throw new Error(`Failed to fetch sprite image: ${spritePath}`);
    }
}

/**
 * Extract icon from sprite
 * @param {Image} spriteImage Sprite image
 * @param {number} x X coordinate
 * @param {number} y Y coordinate
 * @param {number} width Width
 * @param {number} height Height
 * @returns {Image} Extracted icon
 */
function extractIconFromSprite(spriteImage: Image, x: number, y: number, width: number, height: number): Buffer {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(spriteImage, x, y, width, height, 0, 0, width, height);
    return canvas.toBuffer();
}

/**
 * Fetch a TFT champion icon
 * @param {string} championId Champion ID
 * @returns {Promise<Image>} Champion icon
 */
async function fetchTFTChampionIcon(championId: string): Promise<Image> {
    try {
        const cacheKey = `champion_${championId}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Get champion info from metadata
        const championInfo = await getTFTChampionInfo(championId);
        
        if (championInfo && championInfo.image) {
            try {
                // Try to fetch the full image directly
                const fullImagePath = `tft-champion/${championInfo.image.full}`;
                try {
                    const response = await axios.get(
                        `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/${fullImagePath}`,
                        { responseType: 'arraybuffer' }
                    );
                    
                    const buffer = Buffer.from(response.data);
                    imageCache[cacheKey] = buffer;
                    
                    return await loadImage(buffer);
                } catch (error) {
                    // If direct image fails, try to extract from sprite
                    console.log(`Falling back to sprite extraction for champion ${championId}`);
                    const spriteImage = await fetchSpriteImage(championInfo.image.sprite);
                    const iconBuffer = extractIconFromSprite(
                        spriteImage,
                        championInfo.image.x,
                        championInfo.image.y,
                        championInfo.image.w,
                        championInfo.image.h
                    );
                    
                    imageCache[cacheKey] = iconBuffer;
                    return await loadImage(iconBuffer);
                }
            } catch (error) {
                console.error(`Failed to load TFT champion icon from metadata for ${championId}:`, error);
            }
        }
        
        // If all else fails, try standard League champion icon
        const standardChampName = getDragonAPIChampionName(championId);
        const response = await axios.get(
            `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/champion/${standardChampName}.png`,
            { responseType: 'arraybuffer' }
        );
        
        const buffer = Buffer.from(response.data);
        imageCache[cacheKey] = buffer;
        
        return await loadImage(buffer);
    } catch (error) {
        // Fallback to local file if available
        try {
            return await loadImage(path.join(__dirname, '../..', 'assets', 'champion_icons', `${championId}.png`));
        } catch (innerError) {
            // Last resort - create a blank icon
            const canvas = createCanvas(48, 48);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, 48, 48);
            return await loadImage(canvas.toBuffer());
        }
    }
}

/**
 * Fetch a TFT trait icon
 * @param {string} traitId Trait ID
 * @returns {Promise<Image>} Trait icon
 */
async function fetchTFTTraitIcon(traitId: string): Promise<Image> {
    try {
        const cacheKey = `trait_${traitId}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Get trait info from metadata
        const traitInfo = await getTFTTraitInfo(traitId);
        
        if (traitInfo && traitInfo.image) {
            try {
                // Try to fetch the full image directly
                const fullImagePath = `tft-trait/${traitInfo.image.full}`;
                try {
                    const response = await axios.get(
                        `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/${fullImagePath}`,
                        { responseType: 'arraybuffer' }
                    );
                    
                    const buffer = Buffer.from(response.data);
                    imageCache[cacheKey] = buffer;
                    
                    return await loadImage(buffer);
                } catch (error) {
                    // If direct image fails, try to extract from sprite
                    console.log(`Falling back to sprite extraction for trait ${traitId}`);
                    const spriteImage = await fetchSpriteImage(traitInfo.image.sprite);
                    const iconBuffer = extractIconFromSprite(
                        spriteImage,
                        traitInfo.image.x,
                        traitInfo.image.y,
                        traitInfo.image.w,
                        traitInfo.image.h
                    );
                    
                    imageCache[cacheKey] = iconBuffer;
                    return await loadImage(iconBuffer);
                }
            } catch (error) {
                console.error(`Failed to load TFT trait icon from metadata for ${traitId}:`, error);
            }
        }
        
        // If metadata approach fails, try community dragon as fallback
        const cleanTraitName = traitId.split('/').pop()?.toLowerCase() || '';
        const response = await axios.get(
            `https://raw.communitydragon.org/latest/game/assets/ux/tft/traiticons/trait_icon_9_${cleanTraitName}.png`,
            { responseType: 'arraybuffer' }
        );
        
        const buffer = Buffer.from(response.data);
        imageCache[cacheKey] = buffer;
        
        return await loadImage(buffer);
    } catch (error) {
        // Last resort - create a blank icon
        const canvas = createCanvas(18, 18);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 18, 18);
        return await loadImage(canvas.toBuffer());
    }
}

/**
 * Generate an image for a TFT loss
 * @param {TFTMatchDetails} matchDetails TFT match details
 * @param {TFTRankedData} rankedData Ranked data
 * @param {string} summonerName Player's summoner name
 * @returns {Promise<Buffer>} Image buffer
 */
export async function generateImage(matchDetails: TFTMatchDetails, rankedData: TFTRankedData, summonerName: string): Promise<Buffer> {
    try {
        // Create a horizontal, compact canvas with higher resolution
        const canvas = createCanvas(1000, 200);
        const ctx = canvas.getContext('2d');
        
        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        
        // Dark navy background (match TFT UI)
        ctx.fillStyle = '#0A1428';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add subtle pattern to background
        ctx.fillStyle = 'rgba(20, 40, 80, 0.3)';
        for (let i = 0; i < canvas.width; i += 20) {
            for (let j = 0; j < canvas.height; j += 20) {
                if ((i + j) % 40 === 0) {
                    ctx.fillRect(i, j, 10, 10);
                }
            }
        }
        
        // Red accent for defeat
        ctx.fillStyle = '#b1272e';
        ctx.fillRect(0, 0, 5, canvas.height);

        // ===== LEFT SECTION - PLACEMENT AND PLAYER INFO =====
        // Draw placement as a circle with the number
        drawPlacementCircle(ctx, matchDetails.placement, 60, 50);
        
        // Draw summoner name
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#e2e2e2';
        ctx.textAlign = 'left';
        ctx.fillText(summonerName, 20, 130);
        
        // Draw rank below summoner name
        try {
            const rankedIconSize = 30;
            const rankX = 20;
            const rankY = 155;
            
            // Try to draw ranked icon
            try {
                const rankedIcon = await loadImage(path.join(__dirname, '../..', 'assets', 'ranked_icons', `${rankedData.tier}.png`));
                ctx.drawImage(rankedIcon, rankX, rankY - rankedIconSize/2, rankedIconSize, rankedIconSize);
                
                // Draw rank text beside icon
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#e2e2e2';
                ctx.textAlign = 'left';
                ctx.fillText(`${rankedData.tier} ${rankedData.rank}`, rankX + rankedIconSize + 5, rankY + 5);
                
                // Add LP loss indicator if available
                if (rankedData.lpLoss !== undefined) {
                    // Create a more prominent visualization for LP loss
                    const rankWidth = ctx.measureText(`${rankedData.tier} ${rankedData.rank}`).width;
                    // Increase spacing between rank text and LP loss badge
                    const lpLossX = rankX + rankedIconSize + 5 + rankWidth + 20;
                    
                    // Draw a red badge around the LP loss
                    ctx.fillStyle = 'rgba(177, 39, 46, 0.8)'; // Semi-transparent red
                    const lpLossText = `-${rankedData.lpLoss} LP`;
                    const lpLossWidth = ctx.measureText(lpLossText).width + 10; // Add padding
                    
                    // Draw rounded rectangle for the LP loss badge
                    const badgeHeight = 20;
                    const badgeY = rankY - badgeHeight/2;
                    drawRoundedRect(ctx, lpLossX, badgeY, lpLossWidth, badgeHeight, 5);
                    ctx.fill();
                    
                    // Draw LP loss text
                    ctx.fillStyle = '#ffffff'; // White text for better contrast
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(lpLossText, lpLossX + 5, rankY + 5);

                    // Draw a downward arrow to emphasize LP loss
                    const arrowX = lpLossX + lpLossWidth + 5;
                    const arrowY = rankY;
                    drawDownArrow(ctx, arrowX, arrowY, 12, '#ff4d4d');
                }
            } catch (error) {
                // Just show text if icon not found
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#e2e2e2';
                ctx.fillText(`${rankedData.tier} ${rankedData.rank}`, rankX, rankY + 5);
                
                // Add LP loss indicator with red badge if available
                if (rankedData.lpLoss !== undefined) {
                    const rankWidth = ctx.measureText(`${rankedData.tier} ${rankedData.rank}`).width;
                    // Increase spacing between rank text and LP loss badge
                    const lpLossX = rankX + rankWidth + 20;
                    
                    // Draw a red badge around the LP loss
                    ctx.fillStyle = 'rgba(177, 39, 46, 0.8)'; // Semi-transparent red
                    const lpLossText = `-${rankedData.lpLoss} LP`;
                    const lpLossWidth = ctx.measureText(lpLossText).width + 10; // Add padding
                    
                    // Draw rounded rectangle for the LP loss badge
                    const badgeHeight = 20;
                    const badgeY = rankY - badgeHeight/2;
                    drawRoundedRect(ctx, lpLossX, badgeY, lpLossWidth, badgeHeight, 5);
                    ctx.fill();
                    
                    // Draw LP loss text
                    ctx.fillStyle = '#ffffff'; // White text for better contrast
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(lpLossText, lpLossX + 5, rankY + 5);

                    // Draw a downward arrow to emphasize LP loss
                    const arrowX = lpLossX + lpLossWidth + 5;
                    const arrowY = rankY;
                    drawDownArrow(ctx, arrowX, arrowY, 12, '#ff4d4d');
                }
            }
        } catch (error) {
            console.error('Error drawing rank information:', error);
        }

        // ===== CENTER/RIGHT SECTION - CHAMPIONS =====
        // Draw champion composition
        if (matchDetails.units && matchDetails.units.length > 0) {
            // Sort units by tier/cost
            const sortedUnits = [...matchDetails.units].sort((a, b) => b.tier - a.tier || b.rarity - a.rarity);
            
            // Draw up to 8 champions in a row
            const unitsToShow = sortedUnits.slice(0, 8);
            // Increase starting X position to shift composition to the right
            await drawCompactComp(ctx, unitsToShow, 230, 75);
        }

        // ===== AUGMENTS SECTION (MIDDLE) =====
        // Draw augments in the middle
        if (matchDetails.augments && matchDetails.augments.length > 0) {
            // Shift augments position to the right
            await drawAugments(ctx, matchDetails.augments, 500, 130);
        }

        // ===== TRAIT ICONS (BOTTOM) =====
        // Draw active traits as icons at the bottom
        if (matchDetails.traits && matchDetails.traits.length > 0) {
            const activeTraits = matchDetails.traits
                .filter(trait => trait.style > 0)
                .sort((a, b) => b.style - a.style);
            
            // Draw up to 5 trait icons
            const traitsToShow = activeTraits.slice(0, 5);
            // Shift traits position to the right
            await drawTraitIcons(ctx, traitsToShow, 230, 170);
        }
        
        // ===== TAUNT MESSAGE (BOTTOM CENTER) =====
        // Add random taunt message with nice styling
        const tauntMessage = getRandomMessage('tft');
        ctx.font = 'italic bold 16px Arial';
        ctx.fillStyle = '#ffffff';
        
        // Add a subtle background for the taunt message
        const tauntWidth = ctx.measureText(tauntMessage).width;
        // Shift taunt message position to the right and bottom
        const tauntX = 700; // Move further right (was 600)
        const tauntY = canvas.height - 15;
        ctx.fillStyle = 'rgba(30, 30, 60, 0.6)';
        ctx.fillRect(tauntX - tauntWidth/2 - 10, tauntY - 20, tauntWidth + 20, 25);
        
        // Draw the taunt message
        ctx.fillStyle = '#ffffff';
        drawCenteredText(ctx, tauntMessage, tauntX, tauntY, 600);
        
        return canvas.toBuffer();
    } catch (error) {
        console.error('Error generating TFT image:', error);
        
        // Generate a simple fallback image if error occurs
        const canvas = createCanvas(1000, 200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#0A1428';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`TFT Loss - ${summonerName} - Placement: ${matchDetails.placement}/8 - ${rankedData.tier} ${rankedData.rank}`, canvas.width / 2, canvas.height / 2);
        
        return canvas.toBuffer();
    }
}

/**
 * Draw a simple circle with placement number
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} placement Player's placement (1-8)
 * @param {number} x X center position
 * @param {number} y Y center position
 */
function drawPlacementCircle(ctx: NodeCanvasRenderingContext2D, placement: number, x: number, y: number): void {
    const radius = 40;
    
    // Draw circle with red fill
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#b1272e'; // Red background color
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Get placement suffix (st, nd, rd, th)
    const suffix = getPlacementSuffix(placement);
    
    // Draw placement number with suffix
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw main number in larger font
    ctx.fillText(`${placement}`, x - 10, y);
    
    // Draw suffix in smaller font
    ctx.font = 'bold 20px Arial';
    ctx.fillText(suffix, x + 15, y - 8);
    
    // Reset text baseline
    ctx.textBaseline = 'alphabetic';
}

/**
 * Draw trait icons horizontally
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {TFTTrait[]} traits Traits to draw
 * @param {number} startX X starting position
 * @param {number} y Y position
 */
async function drawTraitIcons(ctx: NodeCanvasRenderingContext2D, traits: TFTTrait[], startX: number, y: number): Promise<void> {
    const iconSize = 30;
    const padding = 5;
    
    for (let i = 0; i < traits.length; i++) {
        const trait = traits[i];
        const x = startX + i * (iconSize + padding);
        
        try {
            // Load trait icon
            const traitIcon = await fetchTFTTraitIcon(trait.name);
            
            // Draw circular background based on tier
            ctx.beginPath();
            ctx.arc(x + iconSize/2, y, iconSize/2, 0, Math.PI * 2);
            ctx.fillStyle = getTierBackgroundColor(trait.style);
            ctx.fill();
            
            // Draw trait icon
            ctx.drawImage(traitIcon, x, y - iconSize/2, iconSize, iconSize);
            
            // Add trait count
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(trait.num_units.toString(), x + iconSize/2, y + iconSize/2 + 12);
        } catch (error) {
            console.error(`Failed to draw trait icon for ${trait.name}:`, error);
        }
    }
}

/**
 * Draw augment icons horizontally
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {string[]} augments Augments to draw
 * @param {number} centerX X center position
 * @param {number} y Y position
 */
async function drawAugments(ctx: NodeCanvasRenderingContext2D, augments: string[], centerX: number, y: number): Promise<void> {
    const iconSize = 30;
    const padding = 10; // Increased padding between augments
    const totalWidth = augments.length * (iconSize + padding) - padding;
    const startX = centerX - totalWidth / 2;
    
    for (let i = 0; i < augments.length; i++) {
        const augmentId = augments[i];
        const x = startX + i * (iconSize + padding);
        
        try {
            // Try to load augment icon
            try {
                const augmentIcon = await fetchTFTAugmentIcon(augmentId);
                
                // Draw hexagonal background
                drawHexagon(ctx, x + iconSize/2, y, iconSize/2, '#9E6BFF');
                
                // Draw augment icon
                ctx.drawImage(augmentIcon, x, y - iconSize/2, iconSize, iconSize);
            } catch (error) {
                // Draw placeholder if icon not found
                drawHexagon(ctx, x + iconSize/2, y, iconSize/2, '#9E6BFF');
                
                // Add short name
                const shortName = formatAugmentName(augmentId).substring(0, 2);
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.fillText(shortName, x + iconSize/2, y + 4);
            }
        } catch (error) {
            console.error(`Failed to draw augment icon for ${augmentId}:`, error);
        }
    }
}

/**
 * Draw a hexagon
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} x X center position
 * @param {number} y Y center position
 * @param {number} size Hexagon size
 * @param {string} color Hexagon color
 */
function drawHexagon(ctx: NodeCanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

/**
 * Get background color based on trait tier
 * @param {number} style Trait style (tier)
 * @returns {string} Color
 */
function getTierBackgroundColor(style: number): string {
    switch (style) {
        case 1: return 'rgba(128, 128, 128, 0.7)'; // Bronze/Basic tier
        case 2: return 'rgba(192, 192, 192, 0.7)'; // Silver tier
        case 3: return 'rgba(255, 215, 0, 0.7)';   // Gold tier
        case 4: return 'rgba(147, 112, 219, 0.7)'; // Chromatic/Platinum tier
        default: return 'rgba(64, 64, 64, 0.7)';   // Inactive
    }
}

/**
 * Format augment name
 * @param {string} augmentId Augment ID
 * @returns {string} Formatted augment name
 */
function formatAugmentName(augmentId: string): string {
    // Remove TFT set prefix (e.g., "TFT9_Augment_")
    let name = augmentId.replace(/^TFT\d+_Augment_/, '');
    
    // Convert camelCase to spaces
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    return name;
}

/**
 * Fetch a TFT augment icon
 * @param {string} augmentId Augment ID
 * @returns {Promise<Image>} Augment icon
 */
async function fetchTFTAugmentIcon(augmentId: string): Promise<Image> {
    try {
        const cacheKey = `augment_${augmentId}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Try to fetch from Data Dragon
        try {
            // Augments might be in a different path, attempt to fetch from tft-augment
            const cleanId = augmentId.replace(/^TFT\d+_Augment_/, '');
            const response = await axios.get(
                `https://raw.communitydragon.org/latest/game/assets/ux/tft/augments/${cleanId.toLowerCase()}.png`,
                { responseType: 'arraybuffer' }
            );
            
            const buffer = Buffer.from(response.data);
            imageCache[cacheKey] = buffer;
            
            return await loadImage(buffer);
        } catch (innerError) {
            // Last resort - create a blank hexagon
            const canvas = createCanvas(30, 30);
            const ctx = canvas.getContext('2d');
            drawHexagon(ctx, 15, 15, 15, '#9E6BFF');
            return await loadImage(canvas.toBuffer());
        }
    } catch (error) {
        throw new Error(`Failed to fetch TFT augment icon: ${augmentId}`);
    }
}

/**
 * Draw a placement hexagon (similar to TFT in-game UI)
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} placement Player's placement
 * @param {number} x X center position
 * @param {number} y Y center position
 */
function drawPlacementHexagon(ctx: NodeCanvasRenderingContext2D, placement: number, x: number, y: number): void {
    const size = 35;
    const color = getPlacementColor(placement);
    
    // Draw hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    
    // Fill with placement color
    ctx.fillStyle = color;
    ctx.fill();
    
    // Add border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add placement number
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(placement.toString(), x, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

/**
 * Draw a compact composition (champions in a row)
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {TFTUnit[]} units Units to draw
 * @param {number} startX X starting position
 * @param {number} centerY Y center position
 */
async function drawCompactComp(ctx: NodeCanvasRenderingContext2D, units: TFTUnit[], startX: number, centerY: number): Promise<void> {
    const champSize = 60;
    const padding = 10;
    const maxWidth = 8 * (champSize + padding); // Limit to 8 champions
    
    for (let i = 0; i < units.length && i < 8; i++) {
        const unit = units[i];
        const x = startX + i * (champSize + padding);
        const y = centerY - champSize / 2;
        
        // Get unit color based on cost
        const unitColor = getCostColor(unit.rarity);
        
        try {
            // Load champion icon
            const champIcon = await fetchTFTChampionIcon(unit.character_id);
            
            // Draw champion border based on cost
            ctx.beginPath();
            ctx.rect(x, y, champSize, champSize);
            ctx.strokeStyle = unitColor;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw champion icon with high quality
            ctx.drawImage(champIcon, x, y, champSize, champSize);
            
            // Draw star indicators above champion
            drawStarsAbove(ctx, unit.tier, x + champSize / 2, y - 5, unitColor);
            
            // Remove item display for now to avoid infinite loop
            // if (unit.items && unit.items.length > 0) {
            //     await drawItemIconsBelow(ctx, unit.items, x, y + champSize);
            // }
        } catch (error) {
            console.error(`Failed to draw champion ${unit.character_id}:`, error);
            
            // Draw fallback rectangle with champion name
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(x, y, champSize, champSize);
            ctx.strokeStyle = unitColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, champSize, champSize);
            
            // Add abbreviated name
            const shortName = formatUnitName(unit.character_id).substring(0, 4);
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(shortName, x + champSize / 2, y + champSize / 2);
        }
    }
}

/**
 * Draw item icons below a champion
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number[]} items Item IDs
 * @param {number} champX Champion X position
 * @param {number} topY Top Y position for items
 */
async function drawItemIconsBelow(ctx: NodeCanvasRenderingContext2D, items: number[], champX: number, topY: number): Promise<void> {
    const itemSize = 20;
    const padding = 2;
    const champSize = 60;
    
    // Limit to 3 items maximum
    const itemsToShow = items.slice(0, 3);
    const totalWidth = itemsToShow.length * (itemSize + padding) - padding;
    const startX = champX + (champSize - totalWidth) / 2;
    
    for (let i = 0; i < itemsToShow.length; i++) {
        const itemId = itemsToShow[i];
        const x = startX + i * (itemSize + padding);
        
        try {
            // Try to fetch item icon
            const itemIcon = await fetchTFTItemIcon(itemId);
            
            // Draw circular background
            ctx.beginPath();
            ctx.arc(x + itemSize / 2, topY + itemSize / 2, itemSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = getItemRarityColor(itemId);
            ctx.fill();
            
            // Draw item icon
            ctx.drawImage(itemIcon, x, topY, itemSize, itemSize);
            
            // Draw border
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x + itemSize / 2, topY + itemSize / 2, itemSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (error) {
            // Fallback - draw colored circle
            ctx.beginPath();
            ctx.arc(x + itemSize / 2, topY + itemSize / 2, itemSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = getItemRarityColor(itemId);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

/**
 * Fetch a TFT item icon
 * @param {number} itemId Item ID
 * @returns {Promise<Image>} Item icon
 */
async function fetchTFTItemIcon(itemId: number): Promise<Image> {
    try {
        const cacheKey = `item_${itemId}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Try to fetch from TFT item metadata
        try {
            const metadata = await fetchTFTMetadata('item');
            if (metadata && metadata.data) {
                // Find the item by ID
                const itemKey = Object.keys(metadata.data).find(key => {
                    return metadata.data[key].id === itemId;
                });
                
                if (itemKey && metadata.data[itemKey].image) {
                    const fullImagePath = `tft-item/${metadata.data[itemKey].image.full}`;
                    
                    try {
                        const response = await axios.get(
                            `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/${fullImagePath}`,
                            { responseType: 'arraybuffer' }
                        );
                        
                        const buffer = Buffer.from(response.data);
                        imageCache[cacheKey] = buffer;
                        
                        return await loadImage(buffer);
                    } catch (error) {
                        // If direct image fails, try community dragon
                        throw error;
                    }
                }
            }
            
            // If we couldn't find the item in metadata, try community dragon
            throw new Error("Item not found in metadata");
        } catch (metadataError) {
            // Try community dragon as fallback
            try {
                // Attempt to fetch from community dragon using item ID
                const response = await axios.get(
                    `https://raw.communitydragon.org/latest/game/assets/maps/particles/tft/item_icons/items/${itemId}.png`,
                    { responseType: 'arraybuffer' }
                );
                
                const buffer = Buffer.from(response.data);
                imageCache[cacheKey] = buffer;
                
                return await loadImage(buffer);
            } catch (cdnError) {
                // Final fallback - try standard League item
                try {
                    const response = await axios.get(
                        `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/item/${itemId}.png`,
                        { responseType: 'arraybuffer' }
                    );
                    
                    const buffer = Buffer.from(response.data);
                    imageCache[cacheKey] = buffer;
                    
                    return await loadImage(buffer);
                } catch (finalError) {
                    throw new Error(`Failed to fetch item icon for ID ${itemId}`);
                }
            }
        }
    } catch (error) {
        // Last resort - create a colored circle based on item ID
        const canvas = createCanvas(20, 20);
        const ctx = canvas.getContext('2d');
        
        ctx.beginPath();
        ctx.arc(10, 10, 10, 0, Math.PI * 2);
        ctx.fillStyle = getItemRarityColor(itemId);
        ctx.fill();
        
        return await loadImage(canvas.toBuffer());
    }
}

/**
 * Get color based on item ID to approximate rarity
 * @param {number} itemId Item ID
 * @returns {string} Color
 */
function getItemRarityColor(itemId: number): string {
    // Base item IDs (1-10) are usually basic components
    if (itemId < 10) {
        return 'rgba(169, 169, 169, 0.7)'; // Silver/gray for basic items
    }
    
    // Completed items (usually 10-99)
    if (itemId < 100) {
        return 'rgba(255, 215, 0, 0.7)'; // Gold for completed items
    }
    
    // Special or set-specific items
    return 'rgba(138, 43, 226, 0.7)'; // Purple for special items
}

/**
 * Draw stars above a champion icon with correct colors
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} tier Unit tier (1-3)
 * @param {number} centerX Center X position of stars
 * @param {number} bottomY Bottom Y position of stars
 * @param {string} color Star color (not used - we use tier-based colors)
 */
function drawStarsAbove(ctx: NodeCanvasRenderingContext2D, tier: number, centerX: number, bottomY: number, color: string): void {
    // If tier is 1, don't draw stars
    if (tier <= 1) return;
    
    const starSize = 10;
    const padding = 3;
    const totalWidth = tier * (starSize + padding) - padding;
    const startX = centerX - totalWidth / 2;
    
    // Color based on tier
    let starColor;
    switch(tier) {
        case 2: starColor = '#CD7F32'; // Bronze
            break;
        case 3: starColor = '#FFD700'; // Gold
            break;
        case 4: starColor = '#00FF00'; // Green
            break;
        default: starColor = '#FFFFFF'; // White (fallback)
    }
    
    for (let i = 0; i < tier; i++) {
        const x = startX + i * (starSize + padding);
        drawStar(ctx, x + starSize / 2, bottomY, starSize / 2, starColor);
    }
}

/**
 * Draw a star shape
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} cx Center X
 * @param {number} cy Center Y
 * @param {number} radius Star radius
 * @param {string} color Star color
 */
function drawStar(ctx: NodeCanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string): void {
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius / 2;
    
    ctx.beginPath();
    ctx.fillStyle = color;
    
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

/**
 * Fetch a generic TFT asset
 * @param {string} assetPath Asset path
 * @returns {Promise<Image>} Asset image
 */
async function fetchTFTAsset(assetPath: string): Promise<Image> {
    try {
        const cacheKey = `asset_${assetPath}`;
        
        // Check cache first
        if (imageCache[cacheKey]) {
            return await loadImage(imageCache[cacheKey]);
        }
        
        // Fetch the asset
        const response = await axios.get(
            `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/${assetPath}`,
            { responseType: 'arraybuffer' }
        );
        
        const buffer = Buffer.from(response.data);
        imageCache[cacheKey] = buffer;
        
        return await loadImage(buffer);
    } catch (error) {
        throw new Error(`Failed to fetch TFT asset: ${assetPath}`);
    }
}

/**
 * Get a champion name compatible with Data Dragon API
 * @param {string} championId Champion ID from API
 * @returns {string} Data Dragon compatible champion name
 */
function getDragonAPIChampionName(championId: string): string {
    // Remove prefixes like Set9_, TFT9_, etc.
    let name = championId
        .replace(/^Set\d+_/, '')
        .replace(/^TFT\d+_/, '');
    
    // Special mappings for TFT-specific champions and Data Dragon compatibility
    const champMappings: Record<string, string> = {
        'AurelionSol': 'AurelionSol',
        'Belveth': 'Belveth',
        'Chogath': 'Chogath',
        'DrMundo': 'DrMundo',
        'JarvanIV': 'JarvanIV', 
        'Kaisa': 'Kaisa',
        'Khazix': 'Khazix',
        'KogMaw': 'KogMaw',
        'LeeSin': 'LeeSin',
        'MasterYi': 'MasterYi',
        'MissFortune': 'MissFortune',
        'RekSai': 'RekSai',
        'TahmKench': 'TahmKench',
        'TwistedFate': 'TwistedFate',
        'Velkoz': 'Velkoz',
        'MonkeyKing': 'MonkeyKing', // Wukong is MonkeyKing in the API
        'NidaleCougar': 'Nidalee',
        // Add other special cases as needed
    };
    
    // Check if we have a specific mapping
    if (champMappings[name]) {
        return champMappings[name];
    }
    
    // For summoned units or other special cases
    if (name.includes('SummonLevel')) {
        return 'Heimerdinger'; // Use Heimerdinger icon as a placeholder for summoned units
    }
    
    return name;
}

/**
 * Draw centered text (same as LoL image service)
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {string} text Text to draw
 * @param {number} x X position
 * @param {number} y Y position
 * @param {number} maxWidth Maximum width
 */
function drawCenteredText(ctx: NodeCanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const startX = x - (textWidth / 2);
    
    ctx.fillText(text, startX, y, maxWidth);
}

/**
 * Get color based on placement
 * @param {number} placement Player's placement
 * @returns {string} Color
 */
function getPlacementColor(placement: number): string {
    // 1st place: Gold, 2nd-4th: Silver, 5th-8th: Red
    if (placement === 1) return '#FFD700'; // Gold for 1st
    if (placement <= 4) return '#C0C0C0'; // Silver for 2nd-4th
    return '#b1272e'; // Red for 5th-8th (losses) - match the LoL defeat color
}

/**
 * Get color based on trait tier
 * @param {number} style Trait style (tier)
 * @returns {string} Color
 */
function getTierColor(style: number): string {
    switch (style) {
        case 1: return '#FFFFFF'; // Bronze/Basic tier
        case 2: return '#FFDF00'; // Silver tier
        case 3: return '#FFD700'; // Gold tier
        case 4: return '#9370DB'; // Chromatic/Platinum tier
        default: return '#808080'; // Inactive
    }
}

/**
 * Get color based on unit cost
 * @param {number} cost Unit cost/rarity
 * @returns {string} Color
 */
function getCostColor(cost: number): string {
    switch (cost) {
        case 0: return '#CCCCCC'; // 1 cost
        case 1: return '#CCCCCC'; // 1 cost
        case 2: return '#00CC00'; // 2 cost
        case 3: return '#0099FF'; // 3 cost
        case 4: return '#CC00CC'; // 4 cost
        case 5: return '#FFD700'; // 5 cost
        default: return '#FFFFFF';
    }
}

/**
 * Format trait name to be more readable
 * @param {string} traitId Trait ID from API
 * @returns {string} Formatted trait name
 */
function formatTraitName(traitId: string): string {
    // Remove prefixes like Set9_, TFT9_, etc.
    let name = traitId
        .replace(/^Set\d+_/, '')
        .replace(/^TFT\d+_/, '');
    
    // Handle special cases like "8bit" which should be "8-Bit"
    if (name === '8bit') return '8-Bit';
    
    // Convert camelCase to spaces (e.g., "BigShot" -> "Big Shot")
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Special case for "K/DA" and other specific traits
    if (name === 'KDA') return 'K/DA';
    
    // Handle trait names with numbers (e.g., "Darkin2" -> "Darkin")
    name = name.replace(/(\D+)(\d+)$/, '$1');
    
    return name;
}

/**
 * Format unit name to be more readable
 * @param {string} unitId Unit ID from API
 * @returns {string} Formatted unit name
 */
function formatUnitName(unitId: string): string {
    // Remove prefixes like Set9_, TFT9_, etc.
    let name = unitId
        .replace(/^Set\d+_/, '')
        .replace(/^TFT\d+_/, '');
    
    // Special cases for champions with titles or special formatting
    const championMappings: Record<string, string> = {
        'Ahri': 'Ahri',
        'Akali': 'Akali',
        'Amumu': 'Amumu',
        'Aphelios': 'Aphelios',
        'AurelionSol': 'Aurelion Sol',
        'Belveth': "Bel'Veth",
        'Chogath': "Cho'Gath",
        'DrMundo': 'Dr. Mundo',
        'Evelynn': 'Evelynn',
        'Ezreal': 'Ezreal',
        'Fiddlesticks': 'Fiddlesticks',
        'Galio': 'Galio',
        'Garen': 'Garen',
        'Gwen': 'Gwen',
        'JarvanIV': 'Jarvan IV',
        'Jax': 'Jax',
        'Jhin': 'Jhin',
        'Jinx': 'Jinx',
        'Kaisa': "Kai'Sa",
        'Kalista': 'Kalista',
        'Karma': 'Karma',
        'Kassadin': 'Kassadin',
        'Katarina': 'Katarina',
        'Kayle': 'Kayle',
        'Kayn': 'Kayn',
        'Kennen': 'Kennen',
        'Khazix': "Kha'Zix",
        'Kindred': 'Kindred',
        'KogMaw': "Kog'Maw",
        'Leblanc': 'LeBlanc',
        'LeeSin': 'Lee Sin',
        'Leona': 'Leona',
        'Lillia': 'Lillia',
        'Lissandra': 'Lissandra',
        'Lucian': 'Lucian',
        'Lulu': 'Lulu',
        'Lux': 'Lux',
        'Malphite': 'Malphite',
        'Maokai': 'Maokai',
        'MasterYi': 'Master Yi',
        'MissFortune': 'Miss Fortune',
        'Mordekaiser': 'Mordekaiser',
        'Naafiri': 'Naafiri',
        'Nami': 'Nami',
        'Nasus': 'Nasus',
        'Nilah': 'Nilah',
        'Nocturne': 'Nocturne',
        'Nunu': 'Nunu',
        'Orianna': 'Orianna',
        'Ornn': 'Ornn',
        'Poppy': 'Poppy',
        'Pyke': 'Pyke',
        'Qiyana': 'Qiyana',
        'RekSai': "Rek'Sai",
        'Rell': 'Rell',
        'Renekton': 'Renekton',
        'Riven': 'Riven',
        'Samira': 'Samira',
        'Sejuani': 'Sejuani',
        'Senna': 'Senna',
        'Seraphine': 'Seraphine',
        'Sett': 'Sett',
        'Shen': 'Shen',
        'Shyvana': 'Shyvana',
        'Sion': 'Sion',
        'Sivir': 'Sivir',
        'Skarner': 'Skarner',
        'Sona': 'Sona',
        'Soraka': 'Soraka',
        'Swain': 'Swain',
        'Sylas': 'Sylas',
        'Syndra': 'Syndra',
        'TahmKench': 'Tahm Kench',
        'Taliyah': 'Taliyah',
        'Taric': 'Taric',
        'Teemo': 'Teemo',
        'Thresh': 'Thresh',
        'Tristana': 'Tristana',
        'Tryndamere': 'Tryndamere',
        'TwistedFate': 'Twisted Fate',
        'Urgot': 'Urgot',
        'Varus': 'Varus',
        'Vayne': 'Vayne',
        'Veigar': 'Veigar',
        'Velkoz': "Vel'Koz",
        'Vi': 'Vi',
        'Viego': 'Viego',
        'Viktor': 'Viktor',
        'Warwick': 'Warwick',
        'Wukong': 'Wukong',
        'Xayah': 'Xayah',
        'Yasuo': 'Yasuo',
        'Yone': 'Yone',
        'Yorick': 'Yorick',
        'Yuumi': 'Yuumi',
        'Zac': 'Zac',
        'Zed': 'Zed',
        'Ziggs': 'Ziggs',
        'Zilean': 'Zilean',
        'Zoe': 'Zoe',
        'Zyra': 'Zyra',
        'Heimerdinger': 'Heimerdinger',
        'MonkeyKing': 'Wukong',
        'NidaleCougar': 'Nidalee',
        'SummonLevel1': 'Minion',
        'SummonLevel2': 'Minion',
        'SummonLevel3': 'Minion',
        'SummonLevel4': 'Minion',
    };
    
    // Check if we have a specific mapping
    if (championMappings[name]) {
        return championMappings[name];
    }
    
    // If not in our mapping, try to format it nicely
    // Convert camelCase to spaces (e.g., "BigShot" -> "Big Shot")
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Handle unit names with numbers/variations
    name = name.replace(/(\D+)(\d+)$/, '$1');
    
    return name;
}

/**
 * Get suffix for placement number (1st, 2nd, 3rd, etc.)
 * @param {number} placement Player's placement
 * @returns {string} Suffix
 */
function getPlacementSuffix(placement: number): string {
    if (placement === 1) return 'st';
    if (placement === 2) return 'nd';
    if (placement === 3) return 'rd';
    return 'th';
}

/**
 * Get taunt message with the image (same format as LoL image service)
 * @param {string} discordUsername Discord username
 * @param {Buffer} imageBuffer Image buffer
 * @returns {MessageCreateOptions} Message options
 */
export function getTauntMessage(discordUsername: string, imageBuffer: Buffer): MessageCreateOptions {
    // Create attachment from buffer
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'tft-loss.png' });
    
    // Same format as LoL - just mention the user
    return {
        content: `<@${discordUsername}>`,
        files: [attachment]
    };
}

/**
 * Draw a rounded rectangle
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} x X position
 * @param {number} y Y position
 * @param {number} width Width of rectangle
 * @param {number} height Height of rectangle
 * @param {number} radius Corner radius
 */
function drawRoundedRect(ctx: NodeCanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draw a downward arrow
 * @param {NodeCanvasRenderingContext2D} ctx Canvas context
 * @param {number} x X center position
 * @param {number} y Y top position
 * @param {number} size Size of the arrow
 * @param {string} color Arrow color
 */
function drawDownArrow(ctx: NodeCanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size/2, y - size/4);  // Top left point
    ctx.lineTo(x + size/2, y - size/4);  // Top right point
    ctx.lineTo(x, y + size/2);           // Bottom point
    ctx.closePath();
    ctx.fill();
    
    // Draw the arrow shaft
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - size/4); // Starting just above the arrow head
    ctx.lineTo(x, y - size);   // Extending upward
    ctx.stroke();
}

export default {
    generateImage,
    getTauntMessage
}; 