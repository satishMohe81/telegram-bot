const TelegramBot = require('node-telegram-bot-api');
const { PublicKey, Connection } = require('@solana/web3.js');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Initialize Telegram bots
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN);

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Conversation states
const STATES = {
  AWAITING_COMMAND: 1,
  AWAITING_ADDRESS: 2,
  AWAITING_CONFIRMATION: 3,
  PROCESSING: 4
};

// Store user state
const userStates = new Map();

// Send message to admin
async function notifyAdmin(message) {
  try {
    await adminBot.sendMessage(ADMIN_USER_ID, message);
  } catch (error) {
    console.error(`Failed to notify admin: ${error.message}`);
  }
}

// Generate email text
async function generateEmailText(coinDetails, chatId) {
  const emailText = `Coin: ${coinDetails.name}\nSymbol: ${coinDetails.symbol}\nPrice: $${coinDetails.price}\nAddress: ${coinDetails.address}`;
  try {
    await bot.sendMessage(chatId, `Email text:\n${emailText}`);
    await notifyAdmin(`Email text generated for coin: ${coinDetails.name} (${coinDetails.address})`);
  } catch (error) {
    await bot.sendMessage(chatId, 'Failed to generate email text.');
    await notifyAdmin(`Email text generation failed: ${error.message}`);
    throw error;
  }
}

// Fetch coin details from Solana and CoinGecko
async function getCoinDetails(address, chatId) {
  try {
    const publicKey = new PublicKey(address);
    const tokenInfo = await connection.getAccountInfo(publicKey);
    if (!tokenInfo) {
      throw new Error('Invalid or non-existent token address');
    }
    const response = await fetch(`${COINGECKO_API}/coins/solana/contract/${address}`);
    const data = await response.json();
    if (data.error) {
      throw new Error('Token not found on CoinGecko');
    }
    return {
      name: data.name || 'Unknown Token',
      symbol: data.symbol.toUpperCase() || 'UNKNOWN',
      price: data.market_data?.current_price?.usd || 0,
      address
    };
  } catch (error) {
    await bot.sendMessage(chatId, `Error fetching coin details: ${error.message}`);
    await notifyAdmin(`Error fetching coin details for address ${address}: ${error.message}`);
    return null;
  }
}

// Simulate task with random failure
async function simulateTask(chatId) {
  await new Promise(resolve => setTimeout(resolve, 3000));
  if (Math.random() < 0.5) {
    throw new Error('Task failed');
  }
  return true;
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'What do you want to do? (e.g., "promote")');
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_COMMAND });
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userState = userStates.get(chatId) || { state: null };
  if (text.startsWith('/')) return;
  switch (userState.state) {
    case STATES.AWAITING_COMMAND:
      if (text.toLowerCase() === 'promote') {
        await bot.sendMessage(chatId, 'Which coin do you want to promote? Please send the Solana coin address.');
        await notifyAdmin(`User ${chatId} chose command: ${text}`);
        userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      } else {
        await bot.sendMessage(chatId, 'Invalid command. Please type "promote".');
        await notifyAdmin(`User ${chatId} sent invalid command: ${text}`);
      }
      break;
    case STATES.AWAITING_ADDRESS:
      const coinDetails = await getCoinDetails(text, chatId);
      if (coinDetails) {
        await bot.sendMessage(
          chatId,
          `Coin: ${coinDetails.name}\nSymbol: ${coinDetails.symbol}\nPrice: $${coinDetails.price}\nIs this correct? (Reply "yes" or "no")`
        );
        await notifyAdmin(`User ${chatId} submitted address ${text}. Details: ${coinDetails.name}, ${coinDetails.symbol}, $${coinDetails.price}`);
        userStates.set(chatId, { state: STATES.AWAITING_CONFIRMATION, coinDetails });
      } else {
        userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
      }
      break;
    case STATES.AWAITING_CONFIRMATION:
      if (text.toLowerCase() === 'yes') {
        await bot.sendMessage(chatId, 'Processing... Please wait.');
        await notifyAdmin(`User ${chatId} confirmed coin: ${userState.coinDetails.name}`);
        userStates.set(chatId, { state: STATES.PROCESSING, coinDetails: userState.coinDetails });
        try {
          await generateEmailText(userState.coinDetails, chatId);
          await simulateTask(chatId);
          await bot.sendMessage(chatId, 'Done.');
          await notifyAdmin(`Task completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(chatId, 'Error: Task failed. Try again.');
          await notifyAdmin(`Task failed for user ${chatId}: ${error.message}`);
        }
        userStates.delete(chatId);
      } else {
        await bot.sendMessage(chatId, 'Operation cancelled. What do you want to do?');
        await notifyAdmin(`User ${chatId} cancelled confirmation`);
        userStates.set(chatId, { state: STATES.AWAITING_COMMAND });
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
