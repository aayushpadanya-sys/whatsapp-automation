const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static(__dirname)); // ✅ serves index.html, style.css, script.js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Clean up old auth session
const authPath = path.join(__dirname, '.wwebjs_auth');
if (fs.existsSync(authPath)) {
  fs.rmSync(authPath, { recursive: true, force: true });
  console.log('[Cleanup] .wwebjs_auth folder deleted');
}

// Kill existing Chrome sessions (optional but helpful)
try {
  execSync('taskkill /F /IM chrome.exe');
  console.log('[Cleanup] Chrome processes killed');
} catch (err) {
  console.log('[Cleanup] No Chrome processes found');
}

// File upload setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // keep file name + extension
  }
});
const upload = multer({ storage: storage });


// WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let qrData = '';
let isReady = false;

client.on('qr', async qr => {
  qrData = await qrcode.toDataURL(qr);
  isReady = false;
  console.log('[QR Ready] Scan the code');
});

client.on('ready', () => {
  isReady = true;
  console.log('[WhatsApp Ready] Client connected');
});

client.initialize();

app.get('/qr', (req, res) => {
  if (!qrData) return res.status(404).json({ error: 'QR not ready' });
  res.json({ qr: qrData });
});

app.get('/groups', async (req, res) => {
  if (!isReady) return res.json([]);
  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup).map(c => ({ name: c.name, id: c.id._serialized }));
  res.json(groups);
});

app.post('/send-message', upload.single('image'), async (req, res) => {
  const { groups, message, meetingLink, scheduleTime} = req.body;
  let parsedGroups = [];
  try {
    parsedGroups = JSON.parse(groups);
  } catch {
    return res.status(400).json({ error: 'Invalid group list' });
  }

 const fullMessage =
  message +
  (meetingLink ? `\nJoin Meeting: ${meetingLink}` : '') +
  (scheduleTime ? `\nScheduled at: ${scheduleTime}` : '');

  const scheduledTimestamp = new Date(scheduleTime).getTime();
  const now = Date.now();
  const delay = scheduledTimestamp - now;
  const chats = await client.getChats();

const sendToGroup = async (group) => {
  const chatId = group.id._serialized;

  // ✅ 1. Send image with caption = plain message
  if (req.file) {
    const media = MessageMedia.fromFilePath(req.file.path);
    await client.sendMessage(chatId, media, {
      caption: message || ''
    });
  }

  // ✅ 2. Send Zoom link as a separate message (optional)
  if (meetingLink) {
    await client.sendMessage(chatId, `Join Meeting: ${meetingLink}`);
  }
};



  parsedGroups.forEach(name => {
    const group = chats.find(c => c.isGroup && c.name === name);
    if (!group) return;

    if (delay > 0) {
      setTimeout(() => sendToGroup(group), delay);
    } else {
      sendToGroup(group);
    }
  });

  res.json({
    status: delay > 0 ? `Messages scheduled...` : 'Messages sent immediately',
    savedImage: req.file?.filename || ''
  });
});

  

// ✅ Serve current status of client and QR
app.get('/status', (req, res) => {
  res.json({ ready: isReady, qrReady: !!qrData });
});

// ✅ Serve index.html on root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ✅ Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  exec(`start http://localhost:${port}`);
});
