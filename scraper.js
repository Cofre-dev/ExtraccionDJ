const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const URL_LOGIN = 'https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?https://misiir.sii.cl/cgi_misii/siihome.cgi';

async function iniciarExtraccion(rut, clave) {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1366,768'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        const pagina = await browser.newPage();

        await pagina.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        });

        await loginSII(pagina, rut, clave);
        await navegarADeclaracionesJuradas(pagina);
        const declaraciones = await extraerDeclaraciones(pagina);

        await browser.close();
        return declaraciones;

    } catch (error) {
        if (browser) await browser.close();
        throw error;
    }
}

async function loginSII(pagina, rut, clave) {
    await pagina.goto(URL_LOGIN, { waitUntil: 'networkidle2', timeout: 60000 });

    await esperar(aleatorio(2000, 3500));

    await pagina.waitForSelector('#rutcntr', { timeout: 10000 });

    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').trim();

    await moverMouseAleatorio(pagina);
    await esperar(aleatorio(500, 1000));

    await pagina.click('#rutcntr');
    await esperar(aleatorio(300, 600));

    for (const char of rutLimpio) {
        await pagina.type('#rutcntr', char, { delay: aleatorio(80, 150) });
    }

    await esperar(aleatorio(800, 1500));

    await pagina.waitForSelector('#clave', { timeout: 5000 });
    await moverMouseAleatorio(pagina);
    await esperar(aleatorio(300, 600));

    await pagina.click('#clave');
    await esperar(aleatorio(400, 800));

    for (const char of clave) {
        await pagina.type('#clave', char, { delay: aleatorio(100, 200) });
    }

    await esperar(aleatorio(1000, 2000));

    await moverMouseAleatorio(pagina);
    await esperar(aleatorio(300, 500));

    await pagina.click('#bt_ingresar');

    await esperar(aleatorio(3000, 5000));

    try {
        await pagina.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) { }

    await esperar(aleatorio(1500, 2500));

    const urlActual = pagina.url();
    const contenido = await pagina.content();

    // Verificar si seguimos en la página de login (login falló)
    if (urlActual.includes('IngresoRutClave') && !urlActual.includes('misiir')) {
        if (contenido.includes('Clave incorrecta') || contenido.includes('no coincide') || contenido.includes('incorrecto')) {
            throw new Error('Credenciales inválidas');
        }
        // Si hay mensaje de transacción rechazada específico
        if (contenido.includes('Transaccion Rechazada')) {
            throw new Error('El SII rechazó la conexión. Intenta de nuevo en unos minutos.');
        }
    }

    // Si llegamos aquí, asumimos que el login fue exitoso
    console.log('Login exitoso, URL actual:', urlActual);
    await esperar(aleatorio(1000, 2000));
}

async function navegarADeclaracionesJuradas(pagina) {
    await esperar(1000);

    // Click en "Trámites en línea"
    try {
        await pagina.waitForSelector('li span', { timeout: 8000 });
        const tramitesEnLinea = await pagina.evaluateHandle(() => {
            const spans = document.querySelectorAll('li span');
            for (const span of spans) {
                if (span.textContent.includes('Trámites en línea')) {
                    return span.closest('li');
                }
            }
            return null;
        });

        if (tramitesEnLinea) {
            await tramitesEnLinea.click();
            await esperar(800);
        }
    } catch (e) {
        console.log('No se encontró Trámites en línea, navegando directamente...');
    }

    // Click en "Declaraciones juradas"
    try {
        const djSection = await pagina.evaluateHandle(() => {
            const headers = document.querySelectorAll('h4 span, h4');
            for (const h of headers) {
                if (h.textContent.includes('Declaraciones juradas')) {
                    return h;
                }
            }
            return null;
        });

        if (djSection) {
            await djSection.click();
            await esperar(600);
        }
    } catch (e) { }

    // Click en "Declaraciones juradas de Renta"
    try {
        const djRenta = await pagina.evaluateHandle(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.includes('Declaraciones juradas de Renta')) {
                    return link;
                }
            }
            return null;
        });

        if (djRenta) {
            await djRenta.click();
            await esperar(800);
        }
    } catch (e) { }

    // Click en "Mis declaraciones Juradas"
    try {
        const misDJ = await pagina.evaluateHandle(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.includes('Mis declaraciones Juradas')) {
                    return link;
                }
            }
            return null;
        });

        if (misDJ) {
            await misDJ.click();
            await esperar(1500);
        } else {
            // Navegar directamente si no se encuentra el menú
            await pagina.goto('https://www4.sii.cl/perfilamientodjui/#/declaracionJuradaRenta', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            await esperar(2000);
        }
    } catch (e) {
        await pagina.goto('https://www4.sii.cl/perfilamientodjui/#/declaracionJuradaRenta', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        await esperar(2000);
    }

    // Verificar año tributario 2025
    try {
        await pagina.waitForSelector('select[name="anioTributario"]', { timeout: 10000 });

        const anioActual = await pagina.$eval('select[name="anioTributario"]', el => {
            const selected = el.options[el.selectedIndex];
            return selected ? selected.text : '';
        });

        if (!anioActual.includes('2025')) {
            await pagina.select('select[name="anioTributario"]', 'object:32');
            await esperar(500);

            const btnIr = await pagina.$('button.btn-default:not([disabled])');
            if (btnIr) {
                await btnIr.click();
                await esperar(1500);
            }
        }
    } catch (e) {
        console.log('Año tributario ya está en 2025 o no se pudo cambiar');
    }

    // Esperar a que cargue la tabla
    try {
        await pagina.waitForSelector('table.table-striped tbody tr', { timeout: 15000 });
    } catch (e) {
        await pagina.waitForSelector('.table-responsive', { timeout: 10000 });
    }

    await esperar(1000);
}

async function extraerDeclaraciones(pagina) {
    const declaracionesRaw = await pagina.evaluate(() => {
        const filas = document.querySelectorAll('table.table-striped tbody tr');
        const resultados = [];

        filas.forEach(fila => {
            const celdas = fila.querySelectorAll('td');

            if (celdas.length >= 4) {
                const codigo = celdas[0]?.textContent?.trim() || '';
                const descripcion = celdas[1]?.textContent?.trim() || '';

                let fechaPresentacion = 'Pendiente';
                let estado = 'pendiente';
                const celdaFecha = celdas[3];

                if (celdaFecha) {
                    const alertSuccess = celdaFecha.querySelector('.alert-success');
                    const alertDanger = celdaFecha.querySelector('.alert-danger');

                    if (alertSuccess) {
                        fechaPresentacion = alertSuccess.textContent.trim();
                        estado = 'declarado';
                    } else if (alertDanger) {
                        fechaPresentacion = 'Pendiente';
                        estado = 'pendiente';
                    }
                }

                if (codigo && descripcion) {
                    resultados.push({
                        codigo,
                        descripcion,
                        fechaPresentacion,
                        estado
                    });
                }
            }
        });

        return resultados;
    });

    const declaraciones = declaracionesRaw.map(dj => ({
        codigo: dj.codigo,
        descripcion: normalizarTexto(dj.descripcion),
        fechaPresentacion: dj.fechaPresentacion,
        estado: dj.estado
    }));

    return declaraciones;
}

function formatearRut(rut) {
    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').trim();
    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1).toUpperCase();
    return { cuerpo, dv };
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function aleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function moverMouseAleatorio(pagina) {
    const x = aleatorio(100, 800);
    const y = aleatorio(100, 500);
    await pagina.mouse.move(x, y, { steps: aleatorio(5, 15) });
}

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[ñ]/g, 'n')
        .replace(/[Ñ]/g, 'N')
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[ÁÀÄÂ]/g, 'A')
        .replace(/[ÉÈËÊ]/g, 'E')
        .replace(/[ÍÌÏÎ]/g, 'I')
        .replace(/[ÓÒÖÔ]/g, 'O')
        .replace(/[ÚÙÜÛ]/g, 'U')
        .replace(/[^\x00-\x7F]/g, '');
}

module.exports = { iniciarExtraccion, normalizarTexto };
