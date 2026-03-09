const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwUgVLth52_WtbYls9mOo9_x1Ff_mL9Iw-9HYW66y7-oe8agu3QJk7f4_okIoPl_lsS/exec';
const db = new sqlite3.Database('./lemoniada.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS zapas (id INTEGER PRIMARY KEY, kubeczki INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS zamowienia (id INTEGER PRIMARY KEY AUTOINCREMENT, produkty TEXT, cena_total REAL, platnosc TEXT, data TEXT, kod TEXT, status TEXT)");
    db.run("INSERT OR IGNORE INTO zapas (id, kubeczki) VALUES (1, 0)");
});

app.get('/api/zapas', (req, res) => {
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, row) => res.json({ kubeczki: row ? row.kubeczki : 0 }));
});

app.get('/api/status/:id', (req, res) => {
    db.get("SELECT status FROM zamowienia WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Nie znaleziono" });
        res.json({ status: row.status });
    });
});

app.post('/api/zamow', (req, res) => {
    const { koszyk, kod, platnosc } = req.body;
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, row) => {
        let sztuk = koszyk.reduce((a, b) => a + b.sztuk, 0);
        if (!row || row.kubeczki < sztuk) return res.status(400).json({ error: "Brak kubeczków!" });

        let cena = koszyk.reduce((a, b) => a + (b.cena * b.sztuk), 0);
        let produktyStr = koszyk.map(i => `${i.nazwa} x${i.sztuk}`).join(", ");
        let dataStr = new Date().toLocaleString('pl-PL');

        db.run("INSERT INTO zamowienia (produkty, cena_total, platnosc, data, kod, status) VALUES (?, ?, ?, ?, ?, 'nowe')",
            [produktyStr, cena, platnosc, dataStr, kod || "BRAK"], function(err) {
                db.run("UPDATE zapas SET kubeczki = kubeczki - ? WHERE id = 1", [sztuk]);
                // Wysłanie pojedynczego zamówienia do Google
                axios.post(GOOGLE_URL, { id: this.lastID, data: dataStr, produkty: produktyStr, suma: cena, platnosc: platnosc, kod: kod || "BRAK" }).catch(() => {});
                res.json({ success: true, id: this.lastID });
            });
    });
});

app.get('/api/admin/data', (req, res) => {
    db.get("SELECT kubeczki FROM zapas WHERE id = 1", (err, zapas) => {
        db.all("SELECT * FROM zamowienia WHERE status != 'zrealizowane' ORDER BY id DESC", (err, rows) => {
            db.get("SELECT SUM(cena_total) as total FROM zamowienia", (err, sumRow) => {
                res.json({ kubeczki: zapas ? zapas.kubeczki : 0, zamowienia: rows || [], utarg: (sumRow && sumRow.total) ? sumRow.total : 0 });
            });
        });
    });
});

app.post('/api/admin/status', (req, res) => {
    db.run("UPDATE zamowienia SET status = ? WHERE id = ?", [req.body.status, req.body.id], () => res.json({success:true}));
});

app.post('/api/admin/set-kubeczki', (req, res) => {
    // Zabezpieczenie przed wpisaniem pustego pola lub tekstu (NaN)
    const ilosc = parseInt(req.body.ilosc);
    if (isNaN(ilosc)) return res.status(400).json({success: false, error: "Błędna wartość!"});

    db.run("UPDATE zapas SET kubeczki = ? WHERE id = 1", [ilosc], () => res.json({success: true}));
});

app.post('/api/admin/reset', (req, res) => {
    const workers = req.body.workers || 1;

    // Zanim usuniemy, pobieramy utarg i wysyłamy do Google Raport Dzienny
    db.get("SELECT SUM(cena_total) as total FROM zamowienia", (err, sumRow) => {
        const utarg = (sumRow && sumRow.total) ? sumRow.total : 0;
        const perPerson = (utarg / workers).toFixed(2);
        const dataStr = new Date().toLocaleString('pl-PL');

        axios.post(GOOGLE_URL, {
            typ: "RAPORT_DZIENNY",
            utarg: utarg,
            pracownicy: workers,
            na_glowe: perPerson,
            data: dataStr
        }).catch(() => {});

        // Teraz bezpiecznie czyścimy bazę
        db.run("DELETE FROM zamowienia", () => {
            db.run("DELETE FROM sqlite_sequence WHERE name='zamowienia'", () => res.json({ success: true }));
        });
    });
});

app.listen(8443, () => console.log("🚀 Serwer Lemoniady 8443"));