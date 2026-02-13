const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbxoLDYGUHc5XTpryzBK9Tl7j_Xxa86_7Aodm0mLmtGZYu_u65ItPQdHXaJaIlpvpAu5/exec";
let db = new sqlite3.Database('./lemoniada.db');

db.run(`CREATE TABLE IF NOT EXISTS zamowienia (id INTEGER PRIMARY KEY AUTOINCREMENT, produkty TEXT, suma TEXT, platnosc TEXT, godzina TEXT, kod_rabatowy TEXT, status TEXT DEFAULT 'PRZYJĘTE')`);

let stanKubkow = 0;

app.get('/stan-magazynu', (req, res) => res.json({ kubki: stanKubkow }));

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true, stan: stanKubkow });
});

app.get('/zarobki', (req, res) => {
    db.get(`SELECT SUM(CAST(suma AS REAL)) as total FROM zamowienia`, [], (err, row) => {
        res.json({ total: row ? row.total || 0 : 0 });
    });
});

app.post('/zamow', (req, res) => {
    const { produkty, suma, platnosc, kod } = req.body;
    const ilosc = produkty.split(', ').length;

    if (stanKubkow < ilosc) return res.status(400).json({ error: "BRAK_KUBKOW" });

    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod_rabatowy) VALUES (?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod], function(err) {
            const lastId = this.lastID;
            stanKubkow -= ilosc;
            fetch(GOOGLE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: new Date().toLocaleDateString(), godzina, produkty: `[#${lastId}] ${produkty}`, suma, platnosc, kod: kod || "BRAK" })
            }).catch(e => console.log("Błąd Sheets"));
            res.json({ id: lastId });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC LIMIT 30`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [req.body.nowyStatus, req.body.id], () => res.json({ success: true }));
});

app.post('/reset-bazy', (req, res) => {
    db.run(`DELETE FROM zamowienia`, () => {
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => res.json({ success: true }));
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 LemonIada Engine Online'));