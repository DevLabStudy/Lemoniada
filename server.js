const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

let db = new sqlite3.Database('./lemoniada.db');

// Funkcja tworząca tabelę (wyciągnięta, żeby móc ją wywołać po resecie)
function createTable() {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produkty TEXT,
        suma TEXT,
        platnosc TEXT,
        godzina TEXT,
        status TEXT DEFAULT 'PRZYJĘTE'
    )`);
}
createTable();

let stanKubkow = 0;
let statusDostawy = false;

// --- NOWA FUNKCJA: KONIEC DNIA ---
app.post('/reset-bazy', (req, res) => {
    db.run(`DELETE FROM zamowienia`, (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Opcjonalnie resetujemy też ID zamówień do 1
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`);

        console.log("🧹 Baza została wyczyszczona - Nowy dzień!");
        res.json({ success: true });
    });
});

// Reszta Twoich funkcji bez zmian...
app.get('/stan-magazynu', (req, res) => res.json({ kubki: stanKubkow, przerwa: statusDostawy }));

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true });
});

app.post('/toggle-dostawa', (req, res) => {
    statusDostawy = !statusDostawy;
    res.json({ success: true, przerwa: statusDostawy });
});

app.post('/zamow', (req, res) => {
    const { produkty, suma, platnosc } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina) VALUES (?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina], function(err) {
            if (err) return res.status(500).json({error: err.message});
            stanKubkow--;
            res.json({ id: this.lastID });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => res.json({ success: true }));
});

app.listen(3000, '0.0.0.0', () => console.log('✅ SERWER DZIAŁA I CZEKA NA RESET DNIA'));