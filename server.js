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

// KODY RABATOWE
const PROMO_CODES = { "CHAMPION": 0.15, "FB10": 0.10, "LEMON20": 0.20 };

let db = {
    magazyn: { zwykla: 50, pomaranczowa: 50 },
    utarg: 0,
    historia: []
};

if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
function save() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// Pobieranie statusu (NAPRAWA BŁĘDU Z FOTO: dodano brakujące endpointy)
app.get('/api/status', (req, res) => res.json(db));
app.get('/api/stan-magazynu', (req, res) => res.json(db.magazyn));
app.get('/api/list-zamowienia', (req, res) => res.json(db.historia));
app.get('/api/zarobki', (req, res) => res.json({ suma: db.utarg }));

app.post('/api/zamow', async (req, res) => {
    const { rodzaj, ilosc, kod } = req.body;

    // USTAWIANIE CENY NA SZTYWNO: Zwykła 5, Pomarańcz 7
    const cenaBazowa = rodzaj === 'pomaranczowa' ? 7 : 5;

    if (db.magazyn[rodzaj] < ilosc) return res.status(400).json({ error: "Brak towaru!" });

    let znizka = PROMO_CODES[kod.toUpperCase()] || 0;
    let cenaPoZnizce = (ilosc * cenaBazowa) * (1 - znizka);

    db.magazyn[rodzaj] -= ilosc;
    db.utarg += cenaPoZnizce;

    const log = { data: new Date().toLocaleString(), produkt: rodzaj, ilosc, cena: cenaPoZnizce.toFixed(2), kod: kod.toUpperCase() || "BRAK" };
    db.historia.push(log);
    save();

    try { await axios.post(GOOGLE_URL, log); } catch(e) { console.log("Google Sheets Error"); }

    res.json({ success: true, log, stan: db.magazyn });
});

// ADMIN UPDATE
app.post('/api/admin/update', (req, res) => {
    const { rodzaj, ilosc } = req.body;
    db.magazyn[rodzaj] = parseInt(ilosc);
    save();
    res.json(db.magazyn);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Serwer Lemoniady v4 Gotowy!`));