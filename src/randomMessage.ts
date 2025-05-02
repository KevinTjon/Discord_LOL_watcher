// Dictionary of messages
const leagueMessages: string[] = [
    "XDDDDDDDDDDDDD",
    "Nice try buddy",
    "Hello, your LP is going the wrong way",
    "JG DIFF",
    "stop jacking your cockys buddy",
    "??????????",
    "You ok?",
    "Maybe its alt account angle",
    "Maybe this elo is a bit too high for u",
    "Loser",
    "Going to zou low I see",
    "Next rank is the opposite way buddy",
    // Add more League-specific messages as needed
];

const tftMessages: string[] = [
    "Mortdogged",
    "Rumble ult incoming?",
    "Maybe roll more next time?",
    "1st place is in the opposite direction",
    "Did you forget to scout?",
    "Carousel diff",
    "Better luck next game",
    "Augment diff",
    "Maybe try a different comp?",
    "Top 4? Never heard of it",
    "Have you tried not losing?",
    "Maybe try hyper roll instead",
    // Add more TFT-specific messages as needed
];

/**
 * Get a random message based on game type
 * @param {string} gameType The game type ('league' or 'tft')
 * @returns {string} A random message
 */
function getRandomMessage(gameType: string = 'league'): string {
    // Use the appropriate message list based on game type
    const messages = gameType.toLowerCase() === 'tft' ? tftMessages : leagueMessages;
    const randomIndex: number = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}

export default getRandomMessage; 