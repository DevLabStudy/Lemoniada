const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';
const db = new sqlite3.Database('./lemoniada.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (id TEXT, produkty TEXT, cena_total REAL, platnosc TEXT, status TEXT, data TEXT, kod TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS ustawienia (klucz TEXT PRIMARY KEY, wartosc REAL)`);
    db.run(`INSERT OR IGNORE INTO ustawienia VALUES ('utarg', 0)`);
});

const KODY = { "FB10": 0.1, "CHAMPION": 0.15, "LEMON20": 0.2, "WYGRANA10": 0.1, "WYGRANA15": 0.15, "WYGRANA20": 0.2 };

app.post('/api/zamow', (req, res) => {
    const { koszyk, kod, platnosc } = req.body;
    const id = Math.floor(100 + Math.random() * 899).toString();
    const data = new Date().toLocaleString();

    // Obliczanie ceny z kodem
    let sumaBase = koszyk.reduce((a, b) => a + (b.cena * b.sztuk), 0);
    let znizka = KODY[kod.toUpperCase()] || 0;
    let cenaFinal = (sumaBase * (1 - znizka)).toFixed(2);
    let produktyString = koszyk.map(p => `${p.nazwa} x${p.sztuk}`).join(", ");

    db.run(`INSERT INTO zamowienia VALUES (?, ?, ?, ?, 'przyjęte', ?, ?)`, [id, produktyString, cenaFinal, platnosc, data, kod || "BRAK"], async () => {
        // Natychmiastowy eksport do Google Sheets
        try {
            await axios.post(GOOGLE_URL, {
                data: data, nr: id, produkt: produktyString, cena: cenaFinal, platnosc: platnosc, kod: kod || "BRAK"
            });
        } catch(e) { console.log("Błąd Sheets"); }

        res.json({ success: true, id });
    });
});

app.post('/api/admin/status', (req, res) => {
    const { id, status } = req.body;
    db.get(`SELECT * FROM zamowienia WHERE id = ?`, [id], (err, row) => {
        if(row && status === 'zrealizowane') {
            db.run(`UPDATE ustawienia SET wartosc = wartosc + ? WHERE klucz = 'utarg'`, [row.cena_total]);
        }
        db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [status, id], () => res.json({success:true}));
    });
});

app.get('/api/admin/data', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY rowid DESC LIMIT 50`, (err, rows) => {
        db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'utarg'`, (err, row) => {
            res.json({ zamowienia: rows, utarg: row.wartosc });
        });
    });
});

app.get('/api/status/:id', (req, res) => {
    db.get(`SELECT status FROM zamowienia WHERE id = ?`, [req.params.id], (err, row) => res.json(row));
});

app.listen(8443, '0.0.0.0');