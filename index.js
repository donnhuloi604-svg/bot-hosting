const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();
app.use(express.json());

const bots = new Map();

app.post('/api/add-bot', async (req, res) => {
    const { token, authCode } = req.body;
    if (!token || !authCode || authCode.length !== 6) return res.status(400).json({ error: 'Invalid input' });
    try {
        const client = new Client({ intents: [GatewayIntentBits.Guilds] });
        await client.login(token);
        const info = { botId: client.user.id, botName: client.user.username, serverCount: client.guilds.cache.size };
        await client.destroy();
        res.json({ success: true, ...info });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/start-bot', async (req, res) => {
    const { token, authCode, code } = req.body;
    if (!token || !authCode) return res.status(400).json({ error: 'Missing info' });
    if (bots.has(token)) return res.status(400).json({ error: 'Bot already running' });
    try {
        const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
        if (code) new Function('client', code)(client);
        await client.login(token);
        bots.set(token, { client, authCode, code: code || '' });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/upload-code', async (req, res) => {
    const { token, authCode, code } = req.body;
    if (!bots.has(token) || bots.get(token).authCode !== authCode) return res.status(403).json({ error: 'Unauthorized' });
    try {
        await bots.get(token).client.destroy();
        const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
        new Function('client', code)(client);
        await client.login(token);
        bots.set(token, { client, authCode, code });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/stop-bot', async (req, res) => {
    const { token, authCode } = req.body;
    if (bots.has(token) && bots.get(token).authCode === authCode) {
        try { await bots.get(token).client.destroy(); } catch(e) {}
        bots.delete(token);
    }
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Host Bot Discord</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #7289da; text-align: center; border-bottom: 2px solid #7289da; padding-bottom: 15px; }
        .card { background: #16213e; padding: 20px; border-radius: 12px; margin: 20px 0; }
        input, textarea { width: 100%; padding: 10px; margin: 8px 0; border-radius: 8px; border: none; background: #0f3460; color: #fff; }
        button { padding: 12px 25px; border-radius: 8px; border: none; background: #7289da; color: #fff; font-weight: bold; cursor: pointer; }
        .bot-item { background: #0f3460; padding: 15px; border-radius: 8px; margin: 10px 0; display: flex; justify-content: space-between; }
        .online { color: #2ecc71; }
        .offline { color: #e94560; }
        .message { padding: 10px; border-radius: 8px; margin: 10px 0; }
        .success { background: #2ecc71; }
        .error { background: #e94560; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Host Bot Discord</h1>
        <div class="card">
            <h3>📥 Thêm Bot</h3>
            <input type="password" id="token" placeholder="Token bot...">
            <input type="password" id="auth" placeholder="Mã xác thực (6 số)...">
            <button onclick="addBot()">➕ Thêm Bot</button>
            <div id="msg" class="message" style="display:none"></div>
        </div>
        <div class="card">
            <h3>📋 Danh sách Bot</h3>
            <div id="list"></div>
        </div>
        <div class="card" id="uploadSection" style="display:none">
            <h3>📤 Upload Code</h3>
            <input type="password" id="uploadAuth" placeholder="Mã xác thực...">
            <textarea id="codeArea" rows="8" placeholder="// Code bot của bạn..."></textarea>
            <button onclick="uploadCode()">🚀 Chạy Code</button>
            <div id="uploadMsg" class="message" style="display:none"></div>
        </div>
    </div>
    <script>
        let bots = JSON.parse(localStorage.getItem('bots')) || [];
        const API = window.location.origin + '/api';
        
        function render() {
            const div = document.getElementById('list');
            if (!bots.length) { div.innerHTML = '<p>📭 Chưa có bot nào!</p>'; return; }
            div.innerHTML = bots.map((b, i) => \`
                <div class="bot-item">
                    <div><strong>\${b.name}</strong> <span class="\${b.online ? 'online' : 'offline'}">\${b.online ? '🟢 Online' : '🔴 Offline'}</span></div>
                    <div>
                        <button onclick="startBot(\${i})">▶️</button>
                        <button onclick="showUpload(\${i})">📤</button>
                        <button onclick="deleteBot(\${i})">🗑️</button>
                    </div>
                </div>
            \`).join('');
        }

        async function addBot() {
            const token = document.getElementById('token').value.trim();
            const auth = document.getElementById('auth').value.trim();
            const msg = document.getElementById('msg');
            if (!token || !auth || auth.length !== 6) { showMsg(msg, '❌ Nhập đủ thông tin!', 'error'); return; }
            try {
                const res = await fetch(API + '/add-bot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, authCode: auth })
                });
                const data = await res.json();
                if (data.success) {
                    bots.push({ id: data.botId, name: data.botName, token, authCode: auth, online: true, code: '' });
                    localStorage.setItem('bots', JSON.stringify(bots));
                    render();
                    showMsg(msg, '✅ Thêm thành công!', 'success');
                    document.getElementById('token').value = '';
                    document.getElementById('auth').value = '';
                } else showMsg(msg, '❌ ' + data.error, 'error');
            } catch(e) { showMsg(msg, '❌ Lỗi kết nối!', 'error'); }
        }

        async function startBot(i) {
            const b = bots[i];
            const res = await fetch(API + '/start-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: b.token, authCode: b.authCode, code: b.code || '' })
            });
            const data = await res.json();
            if (data.success) { b.online = true; localStorage.setItem('bots', JSON.stringify(bots)); render(); }
        }

        async function deleteBot(i) {
            const b = bots[i];
            const auth = prompt('🔐 Nhập mã xác thực:');
            if (auth !== b.authCode) return alert('❌ Sai mã!');
            await fetch(API + '/stop-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: b.token, authCode: b.authCode })
            });
            bots.splice(i, 1);
            localStorage.setItem('bots', JSON.stringify(bots));
            render();
        }

        function showUpload(i) {
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('codeArea').value = bots[i].code || '';
            document.getElementById('uploadSection').dataset.index = i;
        }

        async function uploadCode() {
            const i = parseInt(document.getElementById('uploadSection').dataset.index);
            const b = bots[i];
            const auth = document.getElementById('uploadAuth').value.trim();
            const code = document.getElementById('codeArea').value.trim();
            const msg = document.getElementById('uploadMsg');
            if (auth !== b.authCode) { showMsg(msg, '❌ Sai mã!', 'error'); return; }
            const res = await fetch(API + '/upload-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: b.token, authCode: b.authCode, code })
            });
            const data = await res.json();
            if (data.success) { b.code = code; b.online = true; localStorage.setItem('bots', JSON.stringify(bots)); render(); showMsg(msg, '✅ Code đã chạy!', 'success'); }
        }

        function showMsg(el, text, type) {
            el.textContent = text;
            el.className = 'message ' + type;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 5000);
        }

        render();
    </script>
</body>
</html>
    `);
});

app.listen(3000, () => console.log('🚀 Bot Hosting chạy tại port 3000'));
