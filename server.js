const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';

// INICJALIZACJA BAZY SQLITE
const db = new sqlite3.Database('./lemoniada.db', (err) => {
    if (err) console.error("Błąd bazy:", err.message);
    console.log('Połączono z bazą SQLite.');
});

// Tworzenie tabeli zamówień i utargu
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
        id TEXT PRIMARY KEY,
        rodzaj TEXT,
        cena REAL,
        platnosc TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ustawienia (klucz TEXT PRIMARY KEY, wartosc REAL)`);
    db.run(`INSERT OR IGNORE INTO ustawienia (klucz, wartosc) VALUES ('utarg_calkowity', 0)`);
});

// KODY
const HIDDEN_CODES = { "FB10": 0.1, "CHAMPION": 0.15, "LEMON20": 0.2 };
const WIN_CODES = { "WYGRANA10": 0.1, "WYGRANA15": 0.15, "WYGRANA20": 0.2 };

// API: NOWE ZAMÓWIENIE
app.post('/api/zamow', (req, res) => {
    const { rodzaj, cena, kod, platnosc } = req.body;
    const id = Math.floor(100 + Math.random() * 899).toString();

    const znizka = (HIDDEN_CODES[kod.toUpperCase()] || WIN_CODES[kod.toUpperCase()] || 0);
    const finalnaCena = (cena * (1 - znizka)).toFixed(2);

    db.run(`INSERT INTO zamowienia (id, rodzaj, cena, platnosc, status) VALUES (?, ?, ?, ?, 'przyjęte')`,
        [id, rodzaj, finalnaCena, platnosc], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, orderId: id });
        });
});

// API: STATUS DLA KLIENTA
app.get('/api/status/:id', (req, res) => {
    db.get(`SELECT status FROM zamowienia WHERE id = ?`, [req.params.id], (err, row) => {
        res.json(row || { status: 'brak' });
    });
});

// API: ADMIN - POBIERZ WSZYSTKO
app.get('/api/admin/all', (req, res) => {
    db.all(`SELECT * FROM zamowienia WHERE status != 'zrealizowane' ORDER BY timestamp DESC`, [], (err, orders) => {
        db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'utarg_calkowity'`, [], (err, stat) => {
            res.json({ zamowienia: orders, utarg: stat.wartosc });
        });
    });
});

// API: ADMIN - ZMIANA STATUSU (I EXPORT DO GOOGLE)
app.post('/api/admin/status', (req, res) => {
    const { id, nowyStatus } = req.body;

    db.get(`SELECT * FROM zamowienia WHERE id = ?`, [id], (err, order) => {
        if (!order) return res.json({ success: false });

        db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], async () => {
            if (nowyStatus === 'zrealizowane') {
                // Dodaj do utargu
                db.run(`UPDATE ustawienia SET wartosc = wartosc + ? WHERE klucz = 'utarg_calkowity'`, [order.cena]);

                // Wyślij do Google Sheets
                try {
                    await axios.post(GOOGLE_URL, {
                        data: new Date().toLocaleString(),
                        nr: order.id,
                        produkt: order.rodzaj,
                        cena: order.cena,
                        platnosc: order.platnosc
                    });
                } catch (e) { console.log("Google Sheets Error"); }
            }
            res.json({ success: true });
        });
    });
});

app.listen(8443, '0.0.0.0', () => console.log("Serwer SQLite Lemoniada śmiga na porcie 8443! 🍋"));