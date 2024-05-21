// Dictionary of messages
const messages = [
    "XDDDDDDDDDDDDD",
    "Nice try buddy",
    "Hello, your LP is going the wrong way",
    "Rumble ult incoming?",
    "Mortdogged",
    "Next rank is the opposite way buddy",
    "JG DIFF",
    "stop jacking your cockys buddy",
    "??????????",
    "You ok?",
    "Maybe its alt account angle",
    "Maybe this elo is a bit too high for u"
    // Add more messages as needed
];

function getRandomMessage() {
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}

module.exports = getRandomMessage;