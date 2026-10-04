// Catálogo de Pedido a Bodega
// Primera versión funcional.
// zone: zona operativa de referencia para organizar el catálogo.
// unit: unidad propuesta; validar/modificar según el uso real.
// order: orden inicial de navegación, agrupando familias de productos dentro de cada zone.
// active: permite ocultar ítems sin eliminarlos del catálogo.

export const warehouseOrderItems = [
  // =========================
  // BARRA
  // =========================

  { id: "tapa-cafe-8onz", name: "Tapa café 8onz", zone: "Barra", unit: "unidad", order: 1, active: true },
  { id: "tapa-cafe-12onz", name: "Tapa café 12onz", zone: "Barra", unit: "unidad", order: 2, active: true },
  { id: "tapa-brioche-16onz", name: "Tapa Brioche 16onz", zone: "Barra", unit: "unidad", order: 3, active: true },
  { id: "tapa-chico-350-cc", name: "Tapa chico 350 cc", zone: "Barra", unit: "unidad", order: 4, active: true },

  { id: "vaso-cafe-8onz", name: "Vaso de café 8onz", zone: "Barra", unit: "unidad", order: 5, active: true },
  { id: "vaso-cafe-12onz", name: "Vaso de café 12onz", zone: "Barra", unit: "unidad", order: 6, active: true },
  { id: "vaso-brioche-16onz", name: "Vaso Brioche 16onz", zone: "Barra", unit: "unidad", order: 7, active: true },
  { id: "vaso-chico-350", name: "Vaso chico 350", zone: "Barra", unit: "unidad", order: 8, active: true },
  { id: "bombillas", name: "Bombillas", zone: "Barra", unit: "paquete", order: 9, active: true },

  { id: "cafe", name: "Café", zone: "Barra", unit: "kg", order: 10, active: true },
  { id: "cafe-descaf", name: "Cafe descaf", zone: "Barra", unit: "kg", order: 11, active: true },

  { id: "leche-entera", name: "Leche entera", zone: "Barra", unit: "unidad", order: 12, active: true },
  { id: "leche-sin-lactosa", name: "Leche sin lactosa", zone: "Barra", unit: "unidad", order: 13, active: true },
  { id: "leche-avena", name: "LECHE AVENA", zone: "Barra", unit: "unidad", order: 14, active: true },
  { id: "leche-soya", name: "LECHE SOYA", zone: "Barra", unit: "unidad", order: 15, active: true },
  { id: "leche-almendra", name: "LECHE ALMENDRA", zone: "Barra", unit: "unidad", order: 16, active: true },

  { id: "inhala-aman", name: "INHALA AMAN", zone: "Barra", unit: "unidad", order: 17, active: true },
  { id: "armonia-herbal", name: "ARMONIA HERBAL", zone: "Barra", unit: "unidad", order: 18, active: true },
  { id: "viaje-magico", name: "VIAJE MAGICO", zone: "Barra", unit: "unidad", order: 19, active: true },
  { id: "pausa-conscien", name: "PAUSA CONSCIEN", zone: "Barra", unit: "unidad", order: 20, active: true },
  { id: "exhala-atardecer", name: "EXHALA ATARDECER", zone: "Barra", unit: "unidad", order: 21, active: true },
  { id: "natural-peace", name: "NATURAL PEACE", zone: "Barra", unit: "unidad", order: 22, active: true },
  { id: "te-dilhma", name: "TE DILHMA", zone: "Barra", unit: "unidad", order: 23, active: true },
  { id: "te-verde", name: "TE VERDE", zone: "Barra", unit: "caja", order: 24, active: true },
  { id: "bolsa-te-vacia", name: "BOLSA TE VACIA", zone: "Barra", unit: "paquete", order: 25, active: true },
  { id: "te-personal", name: "TE PERSONAL", zone: "Barra", unit: "caja", order: 26, active: true },
  { id: "aniz-flor", name: "ANIZ FLOR", zone: "Barra", unit: "caja", order: 27, active: true },
  { id: "te-jamaica", name: "TE JAMAICA", zone: "Barra", unit: "caja", order: 28, active: true },
  { id: "te-mariposa", name: "TE MARIPOSA", zone: "Barra", unit: "caja", order: 29, active: true },
  { id: "jenjibre", name: "JENJIBRE", zone: "Barra", unit: "kg", order: 30, active: true },

  { id: "chai-polvo", name: "CHAI polvo", zone: "Barra", unit: "unidad", order: 31, active: true },
  { id: "choco-polvo", name: "Choco polvo", zone: "Barra", unit: "unidad", order: 32, active: true },
  { id: "monalisa-crema", name: "MONALISA crema", zone: "Barra", unit: "unidad", order: 33, active: true },
  { id: "choco-blanco", name: "CHOCO blanco", zone: "Barra", unit: "unidad", order: 34, active: true },
  { id: "choco-liquido", name: "CHOCO liquido", zone: "Barra", unit: "unidad", order: 35, active: true },
  { id: "xantana-clara-huev", name: "XANTANA -CLARA HUEV", zone: "Barra", unit: "unidad", order: 36, active: true },
  { id: "oreo", name: "OREO", zone: "Barra", unit: "paquete", order: 37, active: true },
  { id: "oreo-molido", name: "OREO MOLIDO", zone: "Barra", unit: "kg", order: 38, active: true },
  { id: "manjar", name: "MANJAR", zone: "Barra", unit: "kg", order: 39, active: true },
  { id: "mashmellow", name: "MASHMELLOW", zone: "Barra", unit: "paquete", order: 40, active: true },
  { id: "bicarbonato", name: "BICARBONATO", zone: "Barra", unit: "unidad", order: 41, active: true },
  { id: "limon", name: "LIMON", zone: "Barra", unit: "kg", order: 42, active: true },
  { id: "crema-leche", name: "CREMA LECHE", zone: "Barra", unit: "unidad", order: 43, active: true },

  { id: "syrup-menta", name: "SYRUP MENTA", zone: "Barra", unit: "botella", order: 44, active: true },
  { id: "syrup-vainilla", name: "SYRUP VAINILLA", zone: "Barra", unit: "botella", order: 45, active: true },
  { id: "syrup-avellana", name: "SYRUP AVELLANA", zone: "Barra", unit: "botella", order: 46, active: true },
  { id: "syrup-caramelo", name: "SYRUP CARAMELO", zone: "Barra", unit: "botella", order: 47, active: true },
  { id: "syrup-canela", name: "SYRUP CANELA", zone: "Barra", unit: "botella", order: 48, active: true },
  { id: "syrup-coco", name: "SYRUP COCO", zone: "Barra", unit: "botella", order: 49, active: true },
  { id: "syrup-chai", name: "SYRUP CHAI", zone: "Barra", unit: "botella", order: 50, active: true },
  { id: "syrup-amaretto", name: "SYRUP AMARETTO", zone: "Barra", unit: "botella", order: 51, active: true },

  { id: "helado-vainilla", name: "Helado Vainilla", zone: "Barra", unit: "unidad", order: 52, active: true },
  { id: "helado-chocolate", name: "Helado Chocolate", zone: "Barra", unit: "unidad", order: 53, active: true },
  { id: "hielo-frappe", name: "HIELO FRAPPE", zone: "Barra", unit: "bolsa", order: 54, active: true },
  { id: "hielo-cubo", name: "HIELO CUBO", zone: "Barra", unit: "bolsa", order: 55, active: true },

  { id: "pulpa-pina", name: "PULPA PIÑA", zone: "Barra", unit: "unidad", order: 56, active: true },
  { id: "pulpa-melon", name: "PULPA MELON", zone: "Barra", unit: "unidad", order: 57, active: true },
  { id: "pulpa-frutilla", name: "PULPA FRUTILLA", zone: "Barra", unit: "unidad", order: 58, active: true },
  { id: "pulpa-chirimoya", name: "PULPA CHIRIMOYA", zone: "Barra", unit: "unidad", order: 59, active: true },
  { id: "pulpa-mango", name: "PULPA MANGO", zone: "Barra", unit: "unidad", order: 60, active: true },
  { id: "pulpa-frambuesa", name: "PULPA FRAMBUESA", zone: "Barra", unit: "unidad", order: 61, active: true },
  { id: "pulpa-maracuya", name: "PULPA MARACUYA", zone: "Barra", unit: "unidad", order: 62, active: true },
  { id: "arandano-congelado", name: "ARANDANO CONGELADO", zone: "Barra", unit: "unidad", order: 63, active: true },
  { id: "frutilla-congelada", name: "FRUTILLA CONGELADA", zone: "Barra", unit: "unidad", order: 64, active: true },

  { id: "cafiza", name: "CAFIZA", zone: "Barra", unit: "unidad", order: 65, active: true },
  { id: "rinza", name: "RINZA", zone: "Barra", unit: "unidad", order: 66, active: true },

  // =========================
  // SERVICIO / LINEA / ARMADO
  // =========================

  { id: "palito-revolver-cafe", name: "PALITO REVOLVER CAFÉ", zone: "Servicio / Linea / Armado", unit: "paquete", order: 67, active: true },
  { id: "porta-vasos", name: "PORTA VASOS", zone: "Servicio / Linea / Armado", unit: "unidad", order: 68, active: true },

  { id: "azucar-rubia", name: "AZUCAR RUBIA", zone: "Servicio / Linea / Armado", unit: "kg", order: 69, active: true },
  { id: "azucar-blanca", name: "AZUCAR BLANCA", zone: "Servicio / Linea / Armado", unit: "kg", order: 70, active: true },
  { id: "sucralosa", name: "SUCRALOSA", zone: "Servicio / Linea / Armado", unit: "caja", order: 71, active: true },
  { id: "stevia", name: "STEVIA", zone: "Servicio / Linea / Armado", unit: "caja", order: 72, active: true },

  { id: "bandeja-kraft-mediana", name: "Bandeja Kraft mediana", zone: "Servicio / Linea / Armado", unit: "unidad", order: 73, active: true },
  { id: "bandeja-empanada-n4", name: "Bandeja Empanada N4", zone: "Servicio / Linea / Armado", unit: "unidad", order: 74, active: true },

  { id: "pet-7189-1torta", name: "Pet 7189 (1torta)", zone: "Servicio / Linea / Armado", unit: "unidad", order: 75, active: true },
  { id: "pet-h-88-limon", name: "Pet h-88 (limon)", zone: "Servicio / Linea / Armado", unit: "unidad", order: 76, active: true },
  { id: "tapa-c-18-transparente", name: "Tapa C-18 transparente", zone: "Servicio / Linea / Armado", unit: "unidad", order: 77, active: true },

  { id: "caja-brioche-chica-azul", name: "Caja Brioche chica azul", zone: "Servicio / Linea / Armado", unit: "unidad", order: 78, active: true },
  { id: "caja-brioche-grande-azul", name: "Caja Brioche Grande azul", zone: "Servicio / Linea / Armado", unit: "unidad", order: 79, active: true },

  { id: "papel-mantequilla", name: "Papel mantequilla", zone: "Servicio / Linea / Armado", unit: "paquete", order: 80, active: true },
  { id: "sticker-brioche", name: "STICKER BRIOCHE", zone: "Servicio / Linea / Armado", unit: "paquete", order: 81, active: true },

  { id: "bolsa-celofan-10x20", name: "BOLSA CELOFAN 10X20", zone: "Servicio / Linea / Armado", unit: "paquete", order: 82, active: true },
  { id: "bolsa-troquel-28x28x15", name: "Bolsa troquel 28x28x15", zone: "Servicio / Linea / Armado", unit: "paquete", order: 83, active: true },
  { id: "bolsa-troquel-32x32x", name: "Bolsa troquel 32X32X", zone: "Servicio / Linea / Armado", unit: "paquete", order: 84, active: true },
  { id: "alusa", name: "ALUSA", zone: "Servicio / Linea / Armado", unit: "rollo", order: 85, active: true },

  { id: "guantes-s", name: "Guantes S", zone: "Servicio / Linea / Armado", unit: "caja", order: 86, active: true },
  { id: "guantes-m", name: "Guantes M", zone: "Servicio / Linea / Armado", unit: "caja", order: 87, active: true },
  { id: "guantes-l", name: "Guantes L", zone: "Servicio / Linea / Armado", unit: "caja", order: 88, active: true },
  { id: "cubre-calzado", name: "CUBRE CALZADO", zone: "Servicio / Linea / Armado", unit: "paquete", order: 89, active: true },
  { id: "malla-de-cabello", name: "MALLA DE CABELLO", zone: "Servicio / Linea / Armado", unit: "paquete", order: 90, active: true },

  { id: "saco-t400", name: "SACO T400", zone: "Servicio / Linea / Armado", unit: "unidad", order: 91, active: true },
  { id: "velas", name: "VELAS", zone: "Servicio / Linea / Armado", unit: "paquete", order: 92, active: true },
  { id: "aceite", name: "ACEITE", zone: "Servicio / Linea / Armado", unit: "litro", order: 93, active: true },
  { id: "sal", name: "SAL", zone: "Servicio / Linea / Armado", unit: "kg", order: 94, active: true },
  { id: "servilletas", name: "SERVILLETAS", zone: "Servicio / Linea / Armado", unit: "paquete", order: 95, active: true },
  { id: "pano-amarillo", name: "PAÑO AMARILLO", zone: "Servicio / Linea / Armado", unit: "unidad", order: 96, active: true },

  // =========================
  // COPERÍA
  // =========================

  { id: "desengrasante", name: "DESENGRASANTE", zone: "Copería", unit: "botella", order: 97, active: true },
  { id: "lavaloza", name: "LAVALOZA", zone: "Copería", unit: "botella", order: 98, active: true },
  { id: "cloro-gel-cloro", name: "CLORO GEL/CLORO", zone: "Copería", unit: "botella", order: 99, active: true },
  { id: "jabon-liquido", name: "JABON LIQUIDO", zone: "Copería", unit: "botella", order: 100, active: true },
  { id: "limpia-vidrios", name: "LIMPIA VIDRIOS", zone: "Copería", unit: "botella", order: 101, active: true },
  { id: "cif-750gr", name: "CIF 750GR", zone: "Copería", unit: "unidad", order: 102, active: true },
  { id: "limpiapiso", name: "LIMPIAPISO", zone: "Copería", unit: "botella", order: 103, active: true },
  { id: "esponja", name: "ESPONJA", zone: "Copería", unit: "unidad", order: 104, active: true },
  { id: "pastilla-estanque", name: "PASTILLA ESTANQUE", zone: "Copería", unit: "unidad", order: 105, active: true },
  { id: "alcohol", name: "ALCOHOL", zone: "Copería", unit: "botella", order: 106, active: true },
  { id: "lysoform", name: "LYSOFORM", zone: "Copería", unit: "aerosol", order: 107, active: true },
  { id: "pano-microfibra", name: "PAÑO MICROFIBRA", zone: "Copería", unit: "unidad", order: 108, active: true },
  { id: "trapeadores", name: "TRAPEADORES", zone: "Copería", unit: "unidad", order: 109, active: true },
  { id: "bolsa-bas-gra", name: "BOLSA BAS GRA", zone: "Copería", unit: "paquete", order: 110, active: true },
  { id: "bolsa-ba-mediana", name: "BOLSA BA MEDIANA", zone: "Copería", unit: "paquete", order: 111, active: true },
  { id: "bolsa-ba-chica", name: "BOLSA BA CHICA", zone: "Copería", unit: "paquete", order: 112, active: true },

  // =========================
  // BEBIDAS Y AGUAS
  // =========================

  { id: "agua-c-gas", name: "AGUA C GAS", zone: "Bebidas y aguas", unit: "unidad", order: 113, active: true },
  { id: "agua-s-gas", name: "AGUA S GAS", zone: "Bebidas y aguas", unit: "unidad", order: 114, active: true },
  { id: "coca-zero", name: "COCA ZERO", zone: "Bebidas y aguas", unit: "unidad", order: 115, active: true },
  { id: "coca-orig", name: "COCA ORIG", zone: "Bebidas y aguas", unit: "unidad", order: 116, active: true },
  { id: "fanta", name: "FANTA", zone: "Bebidas y aguas", unit: "unidad", order: 117, active: true },
  { id: "sprite", name: "SPRITE", zone: "Bebidas y aguas", unit: "unidad", order: 118, active: true },
  { id: "sprite-zero", name: "SPRITE ZERO", zone: "Bebidas y aguas", unit: "unidad", order: 119, active: true },

  // =========================
  // GENERALES
  // =========================

  { id: "cafe-personal", name: "CAFÉ PERSONAL", zone: "Generales", unit: "unidad", order: 120, active: true },
  { id: "rollo-impresora-grande", name: "ROLLO IMPRESORA GRANDE", zone: "Generales", unit: "rollo", order: 121, active: true },
  { id: "rollo-termico-getnet", name: "ROLLO termico getnet", zone: "Generales", unit: "rollo", order: 122, active: true },
  { id: "nova", name: "NOVA", zone: "Generales", unit: "paquete", order: 123, active: true },
  { id: "confort", name: "CONFORT", zone: "Generales", unit: "paquete", order: 124, active: true }
];