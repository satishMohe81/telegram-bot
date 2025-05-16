const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

// Configuration
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// Initialize bots
const userBot = new TelegramBot(TOKEN, { polling: true });
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: false });

// User session storage
const userSessions = {};

// Forward message to admin bot
function notifyAdmin(chatId, message) {
  adminBot.sendMessage(chatId, `👤 User ${chatId}:\n${message}`);
}

// Get token info from Solana
async function getTokenInfo(tokenAddress) {
  try {
    const connection = new Connection(SOLANA_RPC);
    const publicKey = new PublicKey(tokenAddress);
    
    // Get token metadata (simplified example)
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const token = response.data.pairs[0];
    
    return {
      name: token.baseToken.name,
      symbol: token.baseToken.symbol,
      price: token.priceUsd
    };
  } catch (err) {
    console.error('Token check failed:', err);
    return null;
  }
}

// Start command
userBot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userSessions[chatId] = { step: 1 };
  
  userBot.sendMessage(
    chatId,
    '🛠️ What do you want to do?\n\n' +
    '1. Promote a token\n' +
    '2. Check token stats\n' +
    '3. Other service'
  );
  
  notifyAdmin(chatId, 'Started conversation');
});

// Handle all messages
userBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId] || { step: 0 };
  const text = msg.text;

  notifyAdmin(chatId, `User said: ${text}`);

  try {
    if (session.step === 1) {
      // After selecting action
      if (['1', 'promote'].includes(text.toLowerCase())) {
        session.action = 'promote';
        session.step = 2;
        userBot.sendMessage(chatId, '💰 Enter Solana token address:');
        notifyAdmin(chatId, 'Selected token promotion');
      } else {
        userBot.sendMessage(chatId, '❌ Invalid option, try again');
      }

    } else if (session.step === 2) {
      // Token address input
      session.tokenAddress = text;
      const tokenInfo = await getTokenInfo(text);
      
      if (tokenInfo) {
        session.tokenInfo = tokenInfo;
        session.step = 3;
        userBot.sendMessage(
          chatId,
          `ℹ️ Token Details:\n\n` +
          `Name: ${tokenInfo.name}\n` +
          `Symbol: ${tokenInfo.symbol}\n` +
          `Price: $${tokenInfo.price}\n\n` +
          `Is this correct? (yes/no)`
        );
        notifyAdmin(chatId, `Token verified:\n${JSON.stringify(tokenInfo)}`);
      } else {
        userBot.sendMessage(chatId, '❌ Invalid token address, try again');
      }

    } else if (session.step === 3 && text.toLowerCase() === 'yes') {
      // Confirmation
      session.step = 4;
      userBot.sendMessage(
        chatId,
        '📧 Sending email promotion...\n\n' +
        'This may take a few minutes'
      );
      notifyAdmin(chatId, 'User confirmed token promotion');

      // Simulate email processing
      setTimeout(() => {
        userBot.sendMessage(
          chatId,
          '❌ Failed to send promotion!\n\n' +
          'Please try again later\n\n' +
          'Type /start to begin again'
        );
        notifyAdmin(chatId, 'Promotion failed for user');
        delete userSessions[chatId];
      }, 5000);

    } else if (session.step === 3 && text.toLowerCase() === 'no') {
      userBot.sendMessage(chatId, '🔄 Please enter the correct token address:');
      session.step = 2;
    }
  } catch (err) {
    console.error('Error:', err);
    userBot.sendMessage(chatId, '⚠️ An error occurred, please try again');
    notifyAdmin(chatId, `Error for user ${chatId}: ${err.message}`);
  }
});

console.log('🤖 Main bot is running');
