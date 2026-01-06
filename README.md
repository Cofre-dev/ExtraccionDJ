Extracción DJ - SII Chile
Herramienta automatizada para la extracción masiva del estado de las Declaraciones Juradas (DJ) del año 2025 (Puedes modificar el año) desde el portal del Servicio de Impuestos Internos (SII) de Chile.

Este proyecto permite cargar una lista de empresas mediante un archivo Excel, realizar el login automático en el SII para cada una, extraer el estado de sus declaraciones juradas (código, descripción, fecha de presentación) 
y visualizar los resultados en un dashboard moderno, con opción a exportar toda la información consolidada a un archivo excel.

🚀 Características
Procesamiento Masivo: Carga cientos de empresas simultáneamente mediante una planilla Excel.
Automatización Inteligente: Utiliza Puppeteer con plugins de evasión antibot para navegar el sitio del SII simulando comportamiento humano.
Dashboard Interactivo: Interfaz web moderna para monitorear el progreso de la extracción en tiempo real.
Resultados Detallados: Visualiza qué declaraciones han sido presentadas y cuáles están pendientes.
Exportación de Datos: Descarga un reporte final en Excel con el consolidado de todas las empresas procesadas.

🛠️ Tecnologías Utilizadas
Backend: Node.js, Express
Scraping: Puppeteer, Puppeteer Extra, Stealth Plugin
Manejo de Archivos: Multer, XLSX
Frontend: HTML5, Vanilla CSS (Diseño Responsivo), JavaScript

📋 Requisitos Previos
Node.js (versión 16 o superior recomendada)
NPM (viene instalado con Node.js)

🔧 Instalación
Clona este repositorio:
bash
git clone https://github.com/tu-usuario/extraccion-dj-sii.git
cd extraccion-dj-sii
Instala las dependencias:
bash
npm install

▶️ Uso
Inicia el servidor:
bash
npm start
Abre tu navegador y ve a:
http://localhost:3000

Prepara tu archivo Excel: El archivo debe tener estrictamente 3 columnas en el siguiente orden (la primera fila es de encabezados):
Columna A: Nombre de la Empresa
Columna B: RUT (Ej: 76.123.456-7)
Columna C: Clave Tributaria del SII
Sube el archivo en la aplicación y presiona "Iniciar Extracción".

⚠️ Nota Importante
Este software es una herramienta de automatización que interactúa con un sitio web gubernamental. El uso excesivo o abusivo podría resultar en bloqueos temporales de IP por parte del SII. Úsalo con responsabilidad.

📄 Licencia
Este proyecto está bajo la Licencia MIT.
