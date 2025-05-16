const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Conversation states
const STATES = {
  AWAITING_ADDRESS: 1,
  AWAITING_COMMAND: 2,
  AWAITING_CONFIRMATION: 3,
  VERIFYING: 4
};

// Store user state
const userStates = new Map();

// Send message to admin
async function notifyAdmin(message) {
  try {
    await bot.sendMessage(ADMIN_USER_ID, message);
  } catch (error) {
    console.error(`Failed to notify admin: ${error.message}`);
  }
}

// Generate updated text
async function generateUpdatedText(command, address, chatId) {
  const updatedText = `Command selected: ${command}\nToken Address: ${address}`;
  try {
    await bot.sendMessage(chatId, `Updated text:\n${updatedText}`);
    await notifyAdmin(`Updated text generated for command: ${command}, address: ${address} by user ${chatId}`);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to generate updated text.');
    await notifyAdmin(`Text generation failed for user ${chatId}: ${error.message}`);
    throw error;
  }
}

// Simulate verification with 1-minute delay
async function simulateVerification(chatId) {
  await new Promise(resolve => setTimeout(resolve, 60000)); // 1-minute delay
  throw new Error('Verification failed');
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, '🌟 Welcome to **Solana Raydium Bundler** 🌟');
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userState = userStates.get(chatId) || { state: null };

  if (text.startsWith('/')) return; // Ignore commands

  switch (userState.state) {
    case STATES.AWAITING_ADDRESS:
      await bot.sendMessage(chatId, 'Verifying your token address...');
      await notifyAdmin(`User ${chatId} submitted token address: ${text}`);
      await bot.sendMessage(chatId, 'What do you want to do? (volume booster or buy and sell instantly)');
      userStates.set(chatId, { state: STATES.AWAITING_COMMAND, address: text });
      break;

    case STATES.AWAITING_COMMAND:
      if (text.toLowerCase() === 'volume booster' || text.toLowerCase() === 'buy and sell instantly') {
        await bot.sendMessage(chatId, `You selected: ${text}\nIs this correct? (Reply "yes" or "no")`);
        await notifyAdmin(`User ${chatId} chose command: ${text}`);
        userStates.set(chatId, { state: STATES.AWAITING_CONFIRMATION, address: userState.address, command: text });
      } else {
        await bot.sendMessage(chatId, 'Invalid command. Please choose "volume booster" or "buy and sell instantly".');
        await notifyAdmin(`User ${chatId} sent invalid command: ${text}`);
      }
      break;

    case STATES.AWAITING_CONFIRMATION:
      if (text.toLowerCase() === 'yes') {
        await bot.sendMessage(chatId, 'Processing verification... Please wait 1 minute.');
        await notifyAdmin(`User ${chatId} confirmed command: ${userState.command}`);
        userStates.set(chatId, { state: STATES.VERIFYING, address: userState.address, command: userState.command });

        try {
          await generateUpdatedText(userState.command, userState.address, chatId);
          await simulateVerification(chatId);
          await bot.sendMessage(chatId, 'Done.');
          await notifyAdmin(`Verification completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(chatId, `Error: ${error.message}. Try again.`);
          await notifyAdmin(`Verification failed for user ${chatId}: ${error.message}`);
        }
        userStates.delete(chatId); // Reset conversation
        await bot.sendMessage(chatId, 'Please send the Solana token address to start again.');
        await notifyAdmin(`Conversation reset for user ${chatId}`);
        userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      } else {
        await bot.sendMessage(chatId, 'Operation cancelled. Please send the Solana token address to start again.');
        await notifyAdmin(`User ${chatId} cancelled confirmation`);
        userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      }
      break;

    default:
      await bot.sendMessage(chatId, 'Please use /start to begin.');
      await notifyAdmin(`User ${chatId} sent message without state: ${text}`);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.message}`);
  notifyAdmin(`Bot error: ${error.message}`);
});

console.log('Bot is running...');
