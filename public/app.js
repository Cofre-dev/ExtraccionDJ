const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const btnIniciar = document.getElementById('btnIniciar');
const btnDescargar = document.getElementById('btnDescargar');
const empresasUl = document.getElementById('empresasUl');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const currentEmpresa = document.getElementById('currentEmpresa');
const placeholder = document.getElementById('placeholder');
const empresaDetail = document.getElementById('empresaDetail');
const detailNombre = document.getElementById('detailNombre');
const detailRut = document.getElementById('detailRut');
const djTableBody = document.getElementById('djTableBody');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownText = document.getElementById('dropdownText');
const dropdownCount = document.getElementById('dropdownCount');
const dropdownMenu = document.getElementById('dropdownMenu');
const searchEmpresas = document.getElementById('searchEmpresas');

let empresasCargadas = [];
let resultadosCache = {};
let empresaSeleccionada = null;
let pollingInterval = null;
let dropdownAbierto = false;

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const archivo = e.dataTransfer.files[0];
    if (archivo) procesarArchivo(archivo);
});

fileInput.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (archivo) procesarArchivo(archivo);
});

dropdownTrigger.addEventListener('click', () => {
    dropdownAbierto = !dropdownAbierto;
    toggleDropdown();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper') && dropdownAbierto) {
        dropdownAbierto = false;
        toggleDropdown();
    }
});

searchEmpresas.addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    document.querySelectorAll('.dropdown-list li').forEach(li => {
        const nombre = li.dataset.empresa.toLowerCase();
        if (nombre.includes(busqueda)) {
            li.classList.remove('hidden');
        } else {
            li.classList.add('hidden');
        }
    });
});

function toggleDropdown() {
    if (dropdownAbierto) {
        dropdownTrigger.classList.add('active');
        dropdownMenu.classList.add('open');
        searchEmpresas.focus();
    } else {
        dropdownTrigger.classList.remove('active');
        dropdownMenu.classList.remove('open');
        searchEmpresas.value = '';
        document.querySelectorAll('.dropdown-list li').forEach(li => li.classList.remove('hidden'));
    }
}

async function procesarArchivo(archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);

    fileInfo.textContent = 'Cargando archivo...';
    fileInfo.style.color = 'var(--text-secondary)';

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            empresasCargadas = data.empresas;
            fileInfo.textContent = `✓ ${archivo.name} (${data.total} empresas)`;
            fileInfo.style.color = 'var(--success)';
            btnIniciar.disabled = false;
            dropdownCount.textContent = `${data.total}`;
            renderizarEmpresas();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        fileInfo.textContent = `✗ ${error.message}`;
        fileInfo.style.color = 'var(--danger)';
    }
}

function renderizarEmpresas() {
    empresasUl.innerHTML = '';

    empresasCargadas.forEach((empresa) => {
        const li = document.createElement('li');
        li.className = 'pending';
        li.innerHTML = `
            <span class="empresa-name">${empresa.nombre}</span>
            <span class="empresa-rut">${empresa.rut}</span>
        `;
        li.addEventListener('click', (e) => {
            e.stopPropagation();
            seleccionarEmpresa(empresa.nombre);
            dropdownAbierto = false;
            toggleDropdown();
        });
        li.dataset.empresa = empresa.nombre;
        empresasUl.appendChild(li);
    });
}

function seleccionarEmpresa(nombre) {
    empresaSeleccionada = nombre;

    dropdownText.textContent = nombre;

    document.querySelectorAll('.dropdown-list li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.empresa === nombre) {
            li.classList.add('active');
        }
    });

    const empresa = empresasCargadas.find(e => e.nombre === nombre);
    const resultado = resultadosCache[nombre];

    placeholder.style.display = 'none';
    empresaDetail.style.display = 'block';

    detailNombre.textContent = nombre;
    detailRut.textContent = empresa?.rut || '';

    if (resultado) {
        mostrarDeclaraciones(resultado);
    } else {
        djTableBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    Esperando extracción...
                </td>
            </tr>
        `;
        errorMessage.style.display = 'none';
    }
}

function mostrarDeclaraciones(resultado) {
    const numDeclaradas = document.getElementById('numDeclaradas');
    const numPendientes = document.getElementById('numPendientes');
    const numTotal = document.getElementById('numTotal');

    if (resultado.error) {
        djTableBody.innerHTML = '';
        errorMessage.style.display = 'flex';
        errorText.textContent = resultado.error;
        numDeclaradas.textContent = '0';
        numPendientes.textContent = '0';
        numTotal.textContent = '0';
        return;
    }

    errorMessage.style.display = 'none';

    if (!resultado.declaraciones || resultado.declaraciones.length === 0) {
        djTableBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No se encontraron declaraciones juradas
                </td>
            </tr>
        `;
        numDeclaradas.textContent = '0';
        numPendientes.textContent = '0';
        numTotal.textContent = '0';
        return;
    }

    let countDeclaradas = 0;
    let countPendientes = 0;

    djTableBody.innerHTML = resultado.declaraciones.map(dj => {
        const esPendiente = dj.fechaPresentacion.toLowerCase().includes('pendiente');
        const estadoClass = esPendiente ? 'estado-pendiente' : 'estado-declarado';
        const estadoTexto = esPendiente ? 'Pendiente' : dj.fechaPresentacion;

        if (esPendiente) {
            countPendientes++;
        } else {
            countDeclaradas++;
        }

        return `
            <tr>
                <td class="codigo-cell">${dj.codigo}</td>
                <td>${dj.descripcion}</td>
                <td><span class="estado-badge ${estadoClass}">${estadoTexto}</span></td>
            </tr>
        `;
    }).join('');

    numDeclaradas.textContent = countDeclaradas;
    numPendientes.textContent = countPendientes;
    numTotal.textContent = resultado.declaraciones.length;
}

btnIniciar.addEventListener('click', async () => {
    try {
        const response = await fetch('/iniciar-extraccion', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            btnIniciar.disabled = true;
            progressSection.style.display = 'block';
            iniciarPolling();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error al iniciar la extracción: ' + error.message);
    }
});

function iniciarPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        try {
            const estadoResponse = await fetch('/estado');
            const estado = await estadoResponse.json();

            const porcentaje = estado.total > 0 ? (estado.indiceActual / estado.total) * 100 : 0;
            progressBar.style.width = `${porcentaje}%`;
            progressText.textContent = `${estado.indiceActual} de ${estado.total} empresas`;
            currentEmpresa.textContent = estado.empresaActual ? `Procesando: ${estado.empresaActual}` : '';

            const resultadosResponse = await fetch('/resultados');
            resultadosCache = await resultadosResponse.json();
            actualizarEstadoEmpresas();

            if (empresaSeleccionada && resultadosCache[empresaSeleccionada]) {
                mostrarDeclaraciones(resultadosCache[empresaSeleccionada]);
            }

            if (estado.completado) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                btnDescargar.disabled = false;
                currentEmpresa.textContent = '¡Extracción completada!';
                currentEmpresa.style.color = 'var(--success)';
            }
        } catch (error) {
            console.error('Error en polling:', error);
        }
    }, 2000);
}

function actualizarEstadoEmpresas() {
    document.querySelectorAll('.dropdown-list li').forEach(li => {
        const nombre = li.dataset.empresa;
        const resultado = resultadosCache[nombre];

        li.classList.remove('pending', 'completed', 'error');

        if (resultado) {
            if (resultado.error) {
                li.classList.add('error');
            } else {
                li.classList.add('completed');
            }
        } else {
            li.classList.add('pending');
        }
    });
}

btnDescargar.addEventListener('click', () => {
    window.location.href = '/descargar-excel';
});
