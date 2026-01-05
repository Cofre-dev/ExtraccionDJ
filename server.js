const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const { iniciarExtraccion, normalizarTexto } = require('./scraper');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const extensionesValidas = ['.xlsx', '.xls'];
        const extension = path.extname(file.originalname).toLowerCase();
        if (extensionesValidas.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
    }
});

let empresasData = [];
let resultadosExtraccion = {};
let estadoProceso = {
    activo: false,
    empresaActual: '',
    indiceActual: 0,
    total: 0,
    mensaje: '',
    completado: false
};

app.post('/upload', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const nombreHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[nombreHoja];
        const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 });

        empresasData = [];
        for (let i = 1; i < datos.length; i++) {
            const fila = datos[i];
            if (fila[0] && fila[1] && fila[2]) {
                empresasData.push({
                    nombre: normalizarTexto(String(fila[0]).trim()),
                    rut: String(fila[1]).trim(),
                    clave: String(fila[2]).trim()
                });
            }
        }

        if (empresasData.length === 0) {
            return res.status(400).json({ error: 'El archivo no contiene datos válidos' });
        }

        resultadosExtraccion = {};
        estadoProceso = {
            activo: false,
            empresaActual: '',
            indiceActual: 0,
            total: empresasData.length,
            mensaje: 'Archivo cargado correctamente',
            completado: false
        };

        res.json({
            success: true,
            empresas: empresasData.map(e => ({ nombre: e.nombre, rut: e.rut })),
            total: empresasData.length
        });

    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
    }
});

app.post('/iniciar-extraccion', async (req, res) => {
    if (empresasData.length === 0) {
        return res.status(400).json({ error: 'Primero debe cargar un archivo Excel' });
    }

    if (estadoProceso.activo) {
        return res.status(400).json({ error: 'Ya hay una extracción en curso' });
    }

    estadoProceso.activo = true;
    estadoProceso.completado = false;
    res.json({ success: true, mensaje: 'Extracción iniciada' });

    procesarEmpresas();
});

async function procesarEmpresas() {
    for (let i = 0; i < empresasData.length; i++) {
        const empresa = empresasData[i];

        estadoProceso.indiceActual = i + 1;
        estadoProceso.empresaActual = empresa.nombre;
        estadoProceso.mensaje = `Procesando ${empresa.nombre}...`;

        try {
            const declaraciones = await iniciarExtraccion(empresa.rut, empresa.clave);
            resultadosExtraccion[empresa.nombre] = {
                rut: empresa.rut,
                declaraciones: declaraciones,
                error: null
            };
            estadoProceso.mensaje = `${empresa.nombre} procesada correctamente`;
        } catch (error) {
            resultadosExtraccion[empresa.nombre] = {
                rut: empresa.rut,
                declaraciones: [],
                error: error.message
            };
            estadoProceso.mensaje = `Error en ${empresa.nombre}: ${error.message}`;
        }
    }

    estadoProceso.activo = false;
    estadoProceso.completado = true;
    estadoProceso.mensaje = 'Extracción completada';
}

app.get('/estado', (req, res) => {
    res.json(estadoProceso);
});

app.get('/resultados', (req, res) => {
    res.json(resultadosExtraccion);
});

app.get('/resultados/:empresa', (req, res) => {
    const nombreEmpresa = decodeURIComponent(req.params.empresa);
    if (resultadosExtraccion[nombreEmpresa]) {
        res.json(resultadosExtraccion[nombreEmpresa]);
    } else {
        res.status(404).json({ error: 'Empresa no encontrada' });
    }
});

app.get('/descargar-excel', (req, res) => {
    if (Object.keys(resultadosExtraccion).length === 0) {
        return res.status(400).json({ error: 'No hay resultados para descargar' });
    }

    const workbook = XLSX.utils.book_new();

    for (const [nombreEmpresa, datos] of Object.entries(resultadosExtraccion)) {
        const hojaData = [
            [nombreEmpresa],
            [],
            ['Código', 'Declaración Jurada', 'Estado / Fecha Presentación']
        ];

        if (datos.declaraciones && datos.declaraciones.length > 0) {
            datos.declaraciones.forEach(dj => {
                hojaData.push([dj.codigo, dj.descripcion, dj.fechaPresentacion]);
            });
        } else if (datos.error) {
            hojaData.push(['Error', datos.error, '']);
        }

        const nombreHoja = nombreEmpresa.substring(0, 31).replace(/[\\/*?:\[\]]/g, '');
        const hoja = XLSX.utils.aoa_to_sheet(hojaData);

        hoja['!cols'] = [
            { wch: 10 },
            { wch: 60 },
            { wch: 25 }
        ];

        XLSX.utils.book_append_sheet(workbook, hoja, nombreHoja);
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=Resultados_DJ.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
