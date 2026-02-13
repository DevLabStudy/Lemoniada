const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// --- KONFIGURACJA ---
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwkYKqdIQ_MCokjy22LKNSPwjbHHb6DDyXoMStVxefiN3BYEiviZ-YfWpsDVblKIrBy/exec';
const PORT = 8443;
const db = new sqlite3.Database('./lemoniada.db');

// Inicjalizacja bazy - Upewniamy się, że tabele są poprawne
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS zapas (id INTEGER PRIMARY KEY, kubeczki INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS zamowienia (id INTEGER PRIMARY KEY AUTOINCREMENT, produkty TEXT, cena_total REAL, platnosc TEXT, data TEXT, kod TEXT, status TEXT)");
    db.run("INSERT OR IGNORE INTO zapas (id, kubeczki) VALUES (1, 0)");
});

const KODY = { "START": 2, "LEMON": 5 };

// Endpoint dla klienta: Pobieranie zapasu
app.get('/api/zapas', (req, res) => {
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, row) => {
        res.json({ kubeczki: row ? row.kubeczki : 0 });
    });
});

// Endpoint dla klienta: Składanie zamówienia
app.post('/api/zamow', (req, res) => {
    const { koszyk, kod, platnosc } = req.body;
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, row) => {
        let sztuk = koszyk.reduce((a, b) => a + b.sztuk, 0);
        if (!row || row.kubeczki < sztuk) return res.status(400).json({ error: "Brak kubeczków!" });

        let cena = koszyk.reduce((a, b) => a + (b.cena * b.sztuk), 0);
        let znizka = KODY[kod.toUpperCase()] || 0;
        cena = Math.max(0, cena - znizka);

        let produktyStr = koszyk.map(i => `${i.nazwa} x${i.sztuk}`).join(", ");
        let dataStr = new Date().toLocaleString('pl-PL');

        db.run("INSERT INTO zamowienia (produkty, cena_total, platnosc, data, kod, status) VALUES (?, ?, ?, ?, ?, 'nowe')",
            [produktyStr, cena, platnosc, dataStr, kod], function(err) {
                db.run("UPDATE zapas SET kubeczki = kubeczki - ? WHERE id = 1", [sztuk]);

                axios.post(GOOGLE_URL, {
                    id: this.lastID, data: dataStr, produkty: produktyStr, suma: cena, platnosc: platnosc, kod: kod
                }).catch(e => console.log("Błąd Sheets"));

                res.json({ success: true, id: this.lastID });
            });
    });
});

// Endpoint dla admina: Wszystkie dane
app.get('/api/admin/data', (req, res) => {
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, zapas) => {
        db.all("SELECT * FROM zamowienia ORDER BY id DESC", (err, rows) => {
            let utarg = rows ? rows.reduce((a, b) => a + b.cena_total, 0) : 0;
            res.json({ kubeczki: zapas ? zapas.kubeczki : 0, zamowienia: rows || [], utarg: utarg });
        });
    });
});

// Endpoint dla admina: Ustawianie kubeczków
app.post('/api/admin/set-kubeczki', (req, res) => {
    const ilosc = parseInt(req.body.ilosc);
    db.run("UPDATE zapas SET kubeczki = ? WHERE id = 1", [ilosc], (err) => {
        if (err) return res.status(500).json({success: false});
        res.json({success: true, nowaIlosc: ilosc});
    });
});

// Endpoint dla admina: Zmiana statusu
app.post('/api/admin/status', (req, res) => {
    db.run("UPDATE zamowienia SET status = ? WHERE id = ?", [req.body.status, req.body.id], () => res.json({success:true}));
});

// Endpoint dla admina: Reset dnia
app.post('/api/admin/reset', (req, res) => {
    const { workers } = req.body;
    db.all("SELECT cena_total FROM zamowienia", (err, rows) => {
        let total = rows ? rows.reduce((a, b) => a + b.cena_total, 0) : 0;
        axios.post(GOOGLE_URL, { type: "END_DAY", totalRev: total, workers: workers, data: new Date().toLocaleDateString() })
        .then(() => {
            db.serialize(() => {
                db.run("DELETE FROM zamowienia");
                db.run("DELETE FROM sqlite_sequence WHERE name='zamowienia'");
                res.json({ success: true });
            });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 Serwer śmiga na porcie ${PORT}`));