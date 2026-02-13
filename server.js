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

let stanKubkow = 10;

app.get('/stan-magazynu', (req, res) => res.json({ kubki: stanKubkow }));

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true });
});

app.post('/zamow', (req, res) => {
    console.log("Odebrano zamówienie:", req.body); // Sprawdzaj to w konsoli!
    const { produkty, suma, platnosc, kod } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod_rabatowy) VALUES (?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod], function(err) {
            if (err) {
                console.log("Błąd bazy:", err);
                return res.status(500).json({ error: "Błąd bazy" });
            }
            const lastId = this.lastID;
            stanKubkow--;

            // Wysyłka do Sheets
            fetch(GOOGLE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: new Date().toLocaleDateString(),
                    godzina: godzina,
                    produkty: `[#${lastId}] ${produkty}`,
                    suma: suma,
                    platnosc: platnosc,
                    kod: kod || "BRAK"
                })
            }).then(() => console.log("Wysłano do Sheets")).catch(e => console.log("Błąd Sheets"));

            res.json({ id: lastId });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC LIMIT 20`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [req.body.nowyStatus, req.body.id], () => res.json({ success: true }));
});

app.post('/reset-bazy', (req, res) => {
    db.run(`DELETE FROM zamowienia`, () => {
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => res.json({ success: true }));
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 Serwer działa na porcie 3000'));