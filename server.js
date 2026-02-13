const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// TWÓJ LINK GOOGLE SHEETS
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxoLDYGUHc5XTpryzBK9Tl7j_Xxa86_7Aodm0mLmtGZYu_u65ItPQdHXaJaIlpvpAu5/exec";

let db = new sqlite3.Database('./lemoniada.db');

db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produkty TEXT,
    suma TEXT,
    platnosc TEXT,
    godzina TEXT,
    kod_rabatowy TEXT,
    status TEXT DEFAULT 'PRZYJĘTE'
)`);

let stanKubkow = 10;

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

app.get('/stan-magazynu', (req, res) => res.json({ kubki: stanKubkow }));

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true, kubki: stanKubkow });
});

app.post('/zamow', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma, platnosc, kod } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    // Używamy function(err) zamiast strzałki => aby działało 'this.lastID'
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod_rabatowy) VALUES (?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const lastId = this.lastID; // TO JEST TWÓJ NUMEREK
            stanKubkow--;

            sendToSheets(lastId, produkty, suma, platnosc, kod);
            res.json({ id: lastId }); // Wysyłamy ID do klienta
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC LIMIT 20`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/update-status', (req, res) => {
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [req.body.nowyStatus, req.body.id], () => res.json({ success: true }));
});

app.post('/reset-bazy', (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM zamowienia`);
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => res.json({ success: true }));
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🍋 Serwer LemonIada Gotowy!'));