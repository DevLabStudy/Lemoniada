const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8443;
const DB_FILE = 'lemoniada.json';
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';

// TWOJE KODY RABATOWE
const PROMO_CODES = {
    "CHAMPION": 0.15,
    "FB10": 0.10,
    "LEMON20": 0.20
};

// BAZA DANYCH Z DWOMA RODZAJAMI
let db = {
    magazyn: { zwykla: 50, pomaranczowa: 50 },
    utarg: 0,
    historia: []
};

if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));

function save() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.get('/api/status', (req, res) => res.json(db));

app.post('/api/zamow', async (req, res) => {
    const { rodzaj, ilosc, kod, cenaJednostkowa } = req.body;

    if (db.magazyn[rodzaj] < ilosc) {
        return res.status(400).json({ error: `Brak lemoniady ${rodzaj}!` });
    }

    let znizka = PROMO_CODES[kod.toUpperCase()] || 0;
    let finalPrice = (ilosc * cenaJednostkowa) * (1 - znizka);

    db.magazyn[rodzaj] -= ilosc;
    db.utarg += finalPrice;

    const log = {
        data: new Date().toLocaleString(),
        produkt: rodzaj,
        ilosc: ilosc,
        cena: finalPrice.toFixed(2),
        kod: kod.toUpperCase() || "BRAK"
    };

    db.historia.push(log);
    save();

    try { await axios.post(GOOGLE_URL, log); } catch(e) { console.log("Google Sheets Sync Error"); }

    res.json({ success: true, log, stan: db.magazyn });
});

// ADMIN: AKTUALIZACJA SZTUK
app.post('/api/admin/update', (req, res) => {
    const { rodzaj, ilosc } = req.body;
    if(db.magazyn[rodzaj] !== undefined) {
        db.magazyn[rodzaj] = parseInt(ilosc);
        save();
        res.json({ success: true, stan: db.magazyn });
    } else {
        res.status(400).json({ error: "Zły rodzaj" });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Serwer Lemoniady v3 śmiga!`));