const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8443;
const DB_FILE = 'lemoniada.json';

let db = {
    utarg: 0,
    historia: []
};

if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
function save() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// Endpointy dla Admina
app.get('/api/admin/stats', (req, res) => {
    res.json({ utarg: db.utarg, historia: db.historia });
});

// Rejestracja sprzedaży (stacjonarnej i online)
app.post('/api/zamow', (req, res) => {
    const { rodzaj, cena } = req.body;
    const kwota = parseFloat(cena);

    db.utarg += kwota;
    db.historia.push({
        data: new Date().toLocaleString(),
        produkt: rodzaj,
        kwota: kwota.toFixed(2)
    });

    save();
    res.json({ success: true, suma: db.utarg });
});

// Resetowanie dnia (opcjonalnie)
app.post('/api/admin/reset', (req, res) => {
    db.utarg = 0;
    db.historia = [];
    save();
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Serwer Lemoniady v5 Gotowy!`));