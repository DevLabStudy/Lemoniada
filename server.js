const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxdehKUl5o4GN-ErCMTNLXPGy_V4zB17q1nJV5XoRvJT7tAiTPAcBFtsLxIU6I02Q/exec";

let db = new sqlite3.Database('./lemoniada.db');

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

function sendToSheets(produkty, suma, platnosc, kod) {
    const teraz = new Date();
    const dataString = teraz.toLocaleDateString('pl-PL');
    const godzinaString = teraz.toLocaleTimeString('pl-PL');
    const dzienTygodnia = teraz.toLocaleDateString('pl-PL', { weekday: 'long' });

    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: dataString,
            godzina: godzinaString,
            dzien: dzienTygodnia,
            produkty: produkty,
            suma: suma.includes('zł') ? suma : `${suma} zł`,
            platnosc: platnosc,
            kod: kod || "BRAK"
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
    const { produkty, suma, platnosc, kod } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod) VALUES (?, ?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina, kod], function(err) {
            sendToSheets(produkty, suma, platnosc, kod);
            stanKubkow--;
            res.json({ id: this.lastID });
        });
});

app.post('/sprzedaz-stacjonarna', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod, status) VALUES (?, ?, 'Gotówka (Stacjonarna)', ?, 'BRAK', 'WYDANE')`,
        [produkty, suma, godzina], function(err) {
            sendToSheets(produkty, suma, 'Gotówka (Stacjonarna)', 'BRAK');
            stanKubkow--;
            res.json({ success: true });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => res.json({ success: true }));
});

app.post('/reset-bazy', (req, res) => {
    db.run(`DELETE FROM zamowienia`, () => {
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => res.json({ success: true }));
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SYSTEM LEMONIADY ONLINE'));