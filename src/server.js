const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = 5000;

app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(bodyParser.json());

const db = new sqlite3.Database('./form-app.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Conectado a la base de datos SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS formularios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  descripcion TEXT,
  campos TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Crear formulario con tabla de respuestas personalizada
app.post('/api/formulario', (req, res) => {
  const { nombre, descripcion, campos } = req.body;

  db.run('INSERT INTO formularios (nombre, descripcion, campos) VALUES (?, ?, ?)',
    [nombre, descripcion, JSON.stringify(campos)], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const formularioId = this.lastID;
      let createTableSQL = `CREATE TABLE IF NOT EXISTS respuestas_${formularioId} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombres TEXT,
        apellido_p TEXT,
        apellido_m TEXT,
        matricula TEXT`;

      campos.forEach((_, i) => {
        createTableSQL += `, campo_${i} TEXT`;
      });

      createTableSQL += ')';

      db.run(createTableSQL, err => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Formulario creado', formularioId });
      });
    });
});

// Obtener todos los formularios
app.get('/api/formularios', (req, res) => {
  db.all('SELECT * FROM formularios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(row => row.campos = JSON.parse(row.campos));
    res.json(rows);
  });
});

// Guardar respuestas
app.post('/api/respuesta/:formularioId', (req, res) => {
  const { formularioId } = req.params;
  const respuestas = req.body;

  // Verifica si los campos personales están presentes
  if (!respuestas.nombres || !respuestas.apellido_p || !respuestas.apellido_m || !respuestas.matricula) {
    return res.status(400).json({ error: 'Faltan datos personales del participante' });
  }

  const columnas = ['nombres', 'apellido_p', 'apellido_m', 'matricula'];
  const valores = [
    respuestas.nombres,
    respuestas.apellido_p,
    respuestas.apellido_m,
    respuestas.matricula
  ];

  let i = 0;
  while (respuestas[`campo_${i}`] !== undefined) {
    columnas.push(`campo_${i}`);
    valores.push(respuestas[`campo_${i}`]);
    i++;
  }

  const placeholders = columnas.map(() => '?').join(', ');
  const sql = `INSERT INTO respuestas_${formularioId} (${columnas.join(', ')}) VALUES (${placeholders})`;

  db.run(sql, valores, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Respuesta guardada' });
  });
});


app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
