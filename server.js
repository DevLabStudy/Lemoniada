const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const app = express();
app.use(cors()); app.use(express.json());

const DB_FILE = 'lemoniada.json';
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';

let db = { utarg: 0, zamowienia: {} };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const HIDDEN_CODES = { "FB10": 0.1, "CHAMPION": 0.15, "LEMON20": 0.2 };
const WIN_CODES = { "WYGRANA10": 0.1, "WYGRANA15": 0.15, "WYGRANA20": 0.2 };

app.post('/api/zamow', (req, res) => {
    const { rodzaj, cena, kod, platnosc } = req.body;
    const id = Math.floor(100 + Math.random() * 900).toString();

    let znizka = (HIDDEN_CODES[kod.toUpperCase()] || WIN_CODES[kod.toUpperCase()] || 0);
    let finalnaCena = cena * (1 - znizka);

    db.zamowienia[id] = {
        id, rodzaj, cena: finalnaCena.toFixed(2), platnosc,
        status: 'przyjęte', timestamp: new Date().toLocaleString()
    };
    save();
    res.json({ success: true, orderId: id });
});

app.post('/api/admin/status', async (req, res) => {
    const { id, nowyStatus } = req.body;
    const order = db.zamowienia[id];
    if(order) {
        order.status = nowyStatus;
        if(nowyStatus === 'zrealizowane') {
            db.utarg += parseFloat(order.cena);
            try {
                await axios.post(GOOGLE_URL, {
                    data: order.timestamp, nr: order.id, produkt: order.rodzaj, cena: order.cena, platnosc: order.platnosc
                });
            } catch(e) { console.log("GS Error"); }
        }
        save();
        res.json({ success: true });
    }
});

app.get('/api/status/:id', (req, res) => res.json(db.zamowienia[req.params.id] || {status:'brak'}));
app.get('/api/admin/all', (req, res) => res.json(db));
app.listen(8443, '0.0.0.0');