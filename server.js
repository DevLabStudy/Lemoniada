const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- KONFIGURACJA ---
const GOOGLE_SHEET_URL = "TWÓJ_LINK_Z_APPS_SCRIPT";

let db = new sqlite3.Database('./lemoniada.db');

db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produkty TEXT,
    suma TEXT,
    platnosc TEXT,
    godzina TEXT,
    kod TEXT,
    telefon TEXT,
    status TEXT DEFAULT 'PRZYJĘTE'
)`);

let stanKubkow = 0;
let statusPrzerwy = false;
let powodPrzerwy = "";

function sendToSheets(produkty, suma, platnosc, kod, telefon) {
    const teraz = new Date();
    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: teraz.toLocaleDateString('pl-PL'),
            godzina: teraz.toLocaleTimeString('pl-PL'),
            dzien: teraz.toLocaleDateString('pl-PL', { weekday: 'long' }),
            produkty: produkty,
            suma: suma.includes('zł') ? suma : `${suma} zł`,
            platnosc: platnosc,
            kod: kod || "BRAK",
            telefon: telefon || "NIE PODANO"
        })
    }).catch(e => console.log("Błąd Sheets:", e));
}

app.get('/stan-magazynu', (req, res) => {
    res.json({
        kubki: stanKubkow,
        przerwa: statusPrzerwy || stanKubkow <= 0,
        powod: stanKubkow <= 0 ? "Brak kubków! Zaraz uzupełnimy." : powodPrzerwy
    });
});

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true });
});

app.post('/ustaw-przerwe', (req, res) => {
    statusPrzerwy = req.body.przerwa;
    powodPrzerwy = req.body.powod;
    res.json({ success: true });
});

app.post('/zamow', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma, platnosc, kod, telefon } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod, telefon) VALUES (?, ?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod, telefon], function(err) {
            sendToSheets(produkty, suma, platnosc, kod, telefon);
            stanKubkow--;
            res.json({ id: this.lastID });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => res.json({ success: true }));
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SYSTEM LEMONIADY ONLINE'));