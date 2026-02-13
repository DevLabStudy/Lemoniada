const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// TWOJE DANE Z GOOGLE SHEETS
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxoLDYGUHc5XTpryzBK9Tl7j_Xxa86_7Aodm0mLmtGZYu_u65ItPQdHXaJaIlpvpAu5/exec";

let db = new sqlite3.Database('./lemoniada.db');

// Tworzenie tabeli
db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  produkty TEXT,
                                                  suma TEXT,
                                                  platnosc TEXT,
                                                  godzina TEXT,
                                                  kod TEXT,
                                                  status TEXT DEFAULT 'PRZYJĘTE'
        )`);

let stanKubkow = 0;
let statusPrzerwy = false;
let powodPrzerwy = "";

function sendToSheets(id, produkty, suma, platnosc, kod) {
    const teraz = new Date();
    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: teraz.toLocaleDateString('pl-PL'),
            godzina: teraz.toLocaleTimeString('pl-PL'),
            dzien: teraz.toLocaleDateString('pl-PL', { weekday: 'long' }),
            produkty: `[#${id}] ` + produkty,
            suma: suma,
            platnosc: platnosc,
            kod: kod || "BRAK"
        })
    }).catch(e => console.log("Błąd wysyłki do Sheets"));
}

app.get('/stan-magazynu', (req, res) => {
    res.json({ kubki: stanKubkow, przerwa: statusPrzerwy || stanKubkow <= 0, powod: powodPrzerwy });
});

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true });
});

app.post('/zamow', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma, platnosc, kod } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod) VALUES (?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const lastId = this.lastID;
            sendToSheets(lastId, produkty, suma, platnosc, kod);
            stanKubkow--;
            res.json({ id: lastId });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => res.json({ success: true }));
});

// TWARDY RESET BAZY I NUMERACJI
app.post('/reset-bazy', (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM zamowienia`);
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => {
            res.json({ success: true, message: "Baza i licznik zresetowane" });
        });
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SYSTEM LEMONIADA READY NA PORCIE 3000'));