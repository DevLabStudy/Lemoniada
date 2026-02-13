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
    // Inicjalizacja podstawowych wartości
    db.run(`INSERT OR IGNORE INTO ustawienia VALUES ('utarg', 0)`);
    db.run(`INSERT OR IGNORE INTO ustawienia VALUES ('kubeczki', 0)`);
});

// API: Pobieranie info o kubeczkach
app.get('/api/info', (req, res) => {
    db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, row) => {
        res.json({ kubeczki: row ? row.wartosc : 0 });
    });
});

// API: ADMIN - Ustawianie kubeczków (WERSJA PANCERNA)
app.post('/api/admin/set-kubeczki', (req, res) => {
    const ilosc = parseInt(req.body.ilosc);
    console.log(`[SERWER] Otrzymano żądanie ustawienia kubeczków na: ${ilosc}`);

    if (isNaN(ilosc)) {
        return res.status(400).json({ error: "To nie jest liczba" });
    }

    // INSERT OR REPLACE zadziała nawet jeśli wiersz nie istnieje
    db.run(`INSERT OR REPLACE INTO ustawienia (klucz, wartosc) VALUES ('kubeczki', ?)`, [ilosc], function(err) {
        if (err) {
            console.error("[BŁĄD SQL]", err.message);
            return res.status(500).json({ success: false });
        }
        console.log(`[MAGAZYN] Pomyślnie ustawiono stan na: ${ilosc}`);
        res.json({ success: true, count: ilosc });
    });
});

// API: Składanie zamówienia
app.post('/api/zamow', (req, res) => {
    const { koszyk, kod, platnosc } = req.body;
    const sztukRazem = koszyk.reduce((a, b) => a + b.sztuk, 0);

    db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, row) => {
        const aktualneKubeczki = row ? row.wartosc : 0;
        if (aktualneKubeczki < sztukRazem) {
            return res.status(400).json({ error: "Brak kubeczków! Zostało: " + aktualneKubeczki });
        }

        const id = Math.floor(100 + Math.random() * 899).toString();
        const data = new Date().toLocaleString("pl-PL");
        let cenaFinal = koszyk.reduce((a, b) => a + (b.cena * b.sztuk), 0).toFixed(2);
        let produktyString = koszyk.map(p => `${p.nazwa} x${p.sztuk}`).join(", ");

        db.serialize(() => {
            db.run(`UPDATE ustawienia SET wartosc = wartosc - ? WHERE klucz = 'kubeczki'`, [sztukRazem]);
            db.run(`INSERT INTO zamowienia VALUES (?, ?, ?, ?, 'przyjęte', ?, ?)`, [id, produktyString, cenaFinal, platnosc, data, kod || "BRAK"], async () => {
                try { await axios.post(GOOGLE_URL, { data, nr: id, produkt: produktyString, cena: cenaFinal, platnosc, kod: kod || "BRAK" }); } catch(e) {}
                res.json({ success: true, id });
            });
        });
    });
});

// API: Pobieranie danych dla Admina
app.get('/api/admin/data', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY rowid DESC LIMIT 30`, (err, rows) => {
        db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'utarg'`, (err, rev) => {
            db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, kub) => {
                res.json({ zamowienia: rows || [], utarg: rev ? rev.wartosc : 0, kubeczki: kub ? kub.wartosc : 0 });
            });
        });
    });
});

// API: Status
app.post('/api/admin/status', (req, res) => {
    const { id, status } = req.body;
    db.get(`SELECT * FROM zamowienia WHERE id = ?`, [id], (err, row) => {
        if(row && status === 'zrealizowane' && row.status !== 'zrealizowane') {
            db.run(`UPDATE ustawienia SET wartosc = wartosc + ? WHERE klucz = 'utarg'`, [row.cena_total]);
        }
        db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [status, id], () => res.json({success:true}));
    });
});

app.get('/api/status/:id', (req, res) => {
    db.get(`SELECT status FROM zamowienia WHERE id = ?`, [req.params.id], (err, row) => res.json(row || {status:'brak'}));
});

app.listen(8443, '0.0.0.0', () => console.log("--- SYSTEM ONLINE (8443) ---"));