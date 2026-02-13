const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Konfiguracja Twojego Google Sheets
const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwi35h7ewGcZsOmGod7dsoJk7MGuZ_Xa_kGcrbogO0ytiOEn_CJfXElaOTEmaGECW-3/exec';

// Inicjalizacja bazy SQLite
const db = new sqlite3.Database('./lemoniada.db', (err) => {
    if (err) console.error("Błąd bazy danych:", err.message);
    else console.log("Połączono z bazą SQLite 🍋");
});

// Tworzenie tabel przy starcie
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
        id TEXT, produkty TEXT, cena_total REAL, platnosc TEXT, status TEXT, data TEXT, kod TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ustawienia (klucz TEXT PRIMARY KEY, wartosc REAL)`);
    // Domyślne wartości
    db.run(`INSERT OR IGNORE INTO ustawienia VALUES ('utarg', 0)`);
    db.run(`INSERT OR IGNORE INTO ustawienia VALUES ('kubeczki', 0)`);
});

const KODY = { "FB10": 0.1, "CHAMPION": 0.15, "LEMON20": 0.2, "WYGRANA10": 0.1, "WYGRANA15": 0.15, "WYGRANA20": 0.2 };

// API: Pobieranie info o kubeczkach dla klienta
app.get('/api/info', (req, res) => {
    db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, row) => {
        res.json({ kubeczki: row ? row.wartosc : 0 });
    });
});

// API: Składanie zamówienia (Klient i Admin stacjonarnie)
app.post('/api/zamow', (req, res) => {
    const { koszyk, kod, platnosc } = req.body;
    const sztukRazem = koszyk.reduce((a, b) => a + b.sztuk, 0);

    db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, row) => {
        if (!row || row.wartosc < sztukRazem) {
            return res.status(400).json({ error: `Brak kubeczków! Zostało tylko: ${row ? row.wartosc : 0}` });
        }

        const id = Math.floor(100 + Math.random() * 899).toString();
        const data = new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });

        let sumaBase = koszyk.reduce((a, b) => a + (b.cena * b.sztuk), 0);
        let znizka = KODY[kod.toUpperCase()] || 0;
        let cenaFinal = (sumaBase * (1 - znizka)).toFixed(2);
        let produktyString = koszyk.map(p => `${p.nazwa} x${p.sztuk}`).join(", ");

        // Odejmij kubeczki i zapisz zamówienie
        db.serialize(() => {
            db.run(`UPDATE ustawienia SET wartosc = wartosc - ? WHERE klucz = 'kubeczki'`, [sztukRazem]);
            db.run(`INSERT INTO zamowienia VALUES (?, ?, ?, ?, 'przyjęte', ?, ?)`,
                [id, produktyString, cenaFinal, platnosc, data, kod || "BRAK"],
                async function(err) {
                    if (err) return res.status(500).json({ error: "Błąd zapisu" });

                    // Wyślij do Google Sheets natychmiast
                    try {
                        await axios.post(GOOGLE_URL, {
                            data: data,
                            nr: id,
                            produkt: produktyString,
                            cena: cenaFinal,
                            platnosc: platnosc,
                            kod: kod || "BRAK"
                        });
                    } catch(e) { console.log("Błąd Google Sheets - sprawdz skrypt GAS"); }

                    res.json({ success: true, id });
                }
            );
        });
    });
});

// API: ADMIN - Ustawianie kubeczków
app.post('/api/admin/set-kubeczki', (req, res) => {
    const ilosc = parseInt(req.body.ilosc);
    if (isNaN(ilosc)) return res.status(400).json({ error: "To nie jest liczba" });

    db.run(`UPDATE ustawienia SET wartosc = ? WHERE klucz = 'kubeczki'`, [ilosc], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// API: ADMIN - Pobieranie danych do panelu
app.get('/api/admin/data', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY rowid DESC LIMIT 30`, (err, rows) => {
        db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'utarg'`, (err, rev) => {
            db.get(`SELECT wartosc FROM ustawienia WHERE klucz = 'kubeczki'`, (err, kub) => {
                res.json({
                    zamowienia: rows || [],
                    utarg: rev ? rev.wartosc : 0,
                    kubeczki: kub ? kub.wartosc : 0
                });
            });
        });
    });
});

// API: ADMIN - Zmiana statusu i doliczanie do utargu
app.post('/api/admin/status', (req, res) => {
    const { id, status } = req.body;
    db.get(`SELECT * FROM zamowienia WHERE id = ?`, [id], (err, row) => {
        if (row && status === 'zrealizowane' && row.status !== 'zrealizowane') {
            db.run(`UPDATE ustawienia SET wartosc = wartosc + ? WHERE klucz = 'utarg'`, [row.cena_total]);
        }
        db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [status, id], () => {
            res.json({ success: true });
        });
    });
});

// API: Status dla klienta
app.get('/api/status/:id', (req, res) => {
    db.get(`SELECT status FROM zamowienia WHERE id = ?`, [req.params.id], (err, row) => {
        res.json(row || { status: 'brak' });
    });
});

const PORT = 8443;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- SYSTEM LEMONIADY DZIAŁA ---`);
    console.log(`Port: ${PORT}`);
    console.log(`Baza: SQLite (lemoniada.db)`);
});