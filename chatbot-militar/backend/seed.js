const bcrypt = require('bcryptjs');
const db = require('./db');

const MEDICO = {
  nombre: 'Jair',
  email: 'jair@fanb.mil.ve',
  cedula: '31150106',
  especializacion: 'Medicina General',
  id_medico: '31150106',
  password: '31150106'
};

function buildPaso(titulo, descripcion, duracion, texto_voz) {
  return { titulo, descripcion, duracion, texto_voz, imagen: '' };
}

const INSTRUCCIONES = [
  {
    titulo: 'HERIDA DE BALA',
    categoria: 'Trauma',
    severidad: 'critico',
    parte_cuerpo: 'torax',
    tiempo_estimado: '15 min',
    descripcion: [
      'Herida por proyectil de arma de fuego en el torso',
      'Sangrado abundante en el pecho o abdomen',
      'Orificio de entrada y salida de bala',
      'Herida abierta con sangrado que no para',
      'Impacto de bala en el cuerpo',
      'Lesion por disparo en el pecho o barriga',
      'Ayuda para compañero herido por arma de fuego'
    ].join('\n'),
    pasos: [
      buildPaso('Seguridad de escena',
        'Asegúrese de que el área esté segura. Use guantes y equipo de protección personal. Solicite apoyo táctico si es necesario.',
        15, 'Asegúrese de que el área esté segura antes de actuar.'),
      buildPaso('Evaluación inicial',
        'Verifique consciencia, vía aérea, respiración y circulación. Identifique el orificio de entrada y salida del proyectil.',
        30, 'Evalúe al paciente. Busque orificio de entrada y salida.'),
      buildPaso('Control de hemorragia',
        'Aplique presión directa con gasa estéril sobre la herida. Si hay hemorragia severa, aplique torniquete proximal a la herida.',
        60, 'Controle la hemorragia con presión directa o torniquete.'),
      buildPaso('Vendaje oclusivo',
        'Para heridas penetrantes de tórax, aplique vendaje oclusivo en tres lados (válvula). Para abdomen, cubra con gasa húmeda estéril.',
        30, 'Aplique vendaje oclusivo.'),
      buildPaso('Inmovilización y evacuación',
        'Inmovilice al paciente en posición neutral. Evacúe a centro quirúrgico lo antes posible. No extraiga el proyectil.',
        30, 'Inmovilice y evacúe al centro quirúrgico. No intente extraer el proyectil.'),
      buildPaso('Monitoreo continuo',
        'Vigile signos vitales cada 5 minutos. Esté atento a signos de shock hipovolémico: palidez, taquicardia, hipotensión.',
        30, 'Monitoree signos vitales cada 5 minutos.')
    ]
  },
  {
    titulo: 'HEMORRAGIA SEVERA',
    categoria: 'Emergencia',
    severidad: 'critico',
    parte_cuerpo: 'brazos',
    tiempo_estimado: '10 min',
    descripcion: [
      'Perdida abundante de sangre en brazo o pierna',
      'Sangre que no se detiene con presion',
      'Herida profunda que sangra mucho en una extremidad',
      'La persona se ve palida y mareada por perdida de sangre',
      'Sangrado arterial con sangre roja brillante que sale a chorros',
      'Corte profundo en el brazo o pierna con mucha sangre',
      'Hemorrhagia que no para con simple presion'
    ].join('\n'),
    pasos: [
      buildPaso('Identificar tipo de hemorragia',
        'Determine si es arterial (sangre roja brillante, pulsatil), venosa (sangre oscura, flujo continuo) o capilar.',
        10, 'Identifique el tipo de hemorragia.'),
      buildPaso('Presión directa',
        'Aplique presión directa firme con gasa o apósito estéril sobre el punto de sangrado. Mantenga presión constante por 10 minutos.',
        60, 'Aplique presión directa firme sobre la herida.'),
      buildPaso('Elevación del miembro',
        'Eleve la extremidad afectada por encima del nivel del corazón para reducir el flujo sanguíneo.',
        10, 'Eleve el miembro afectado.'),
      buildPaso('Torniquete (si persiste)',
        'Si la hemorragia no cede, aplique torniquete 5-8 cm proximal a la herida. Registre hora de colocación. Nunca lo retire en campo.',
        45, 'Si no cede, aplique torniquete y registre la hora. No lo retire.'),
      buildPaso('Vendaje compresivo',
        'Una vez controlada la hemorragia, aplique vendaje compresivo. Evalúe pulso distal cada 15 minutos.',
        30, 'Aplique vendaje compresivo y evalúe pulso distal.'),
      buildPaso('Manejo del shock',
        'Tumbo al paciente, eleve piernas 30 grados si no hay lesión medular. Administre líquidos IV si está entrenado. Evacúe urgente.',
        30, 'Maneje el shock: tumbe al paciente y eleve piernas. Evacúe urgente.')
    ]
  },
  {
    titulo: 'RCP (REANIMACION CARDIOPULMONAR)',
    categoria: 'Paro Cardiaco',
    severidad: 'critico',
    parte_cuerpo: 'torax',
    tiempo_estimado: '20 min',
    descripcion: [
      'Persona inconsciente que no responde al llamado',
      'Alguien que no respira o solo jadea',
      'Persona desplomada sin signos de vida',
      'Como hacer reanimacion cardiopulmonar paso a paso',
      'Emergencia: alguien se desmayo y no despierta',
      'El corazon dejo de latir, necesita RCP urgente',
      'Companero inconsciente que no se mueve',
      'Ahogamiento con perdida del conocimiento',
      'Paro cardiaco repentino en el campo'
    ].join('\n'),
    pasos: [
      buildPaso('Verificar inconsciencia',
        'Verifique si el paciente responde. Sacuda los hombros suavemente y pregunte "¿Está bien?" en voz alta.',
        10, 'Verifique si el paciente responde.'),
      buildPaso('Pedir ayuda y DEA',
        'Active el sistema de emergencia. Pida un Desfibrilador Externo Automático (DEA). Si está solo, realice RCP 2 minutos antes de buscar ayuda.',
        10, 'Pida ayuda y un desfibrilador.'),
      buildPaso('Apertura de vía aérea',
        'Coloque al paciente boca arriba sobre superficie firme. Incline la cabeza hacia atrás y eleve el mentón (maniobra frente-mentón).',
        10, 'Abra la vía aérea inclinando la cabeza y elevando el mentón.'),
      buildPaso('Verificar respiración',
        'Mire, escuche y sienta por no más de 10 segundos. Si no respira o solo jadea, inicie compresiones.',
        10, 'Verifique si respira. Si no, inicie compresiones.'),
      buildPaso('Compresiones torácicas',
        'Coloque el talón de una mano en el centro del pecho (mitad inferior del esternón). La otra mano encima. Comprima 5-6 cm a 100-120 compresiones por minuto.',
        120, 'Realice compresiones en el centro del pecho, fuerte y rápido.'),
      buildPaso('Ventilaciones de rescate',
        'Después de 30 compresiones, dé 2 ventilaciones. Selle la nariz, sople por 1 segundo hasta que el pecho se eleve. Ciclo 30:2.',
        30, 'Cada 30 compresiones, dé 2 respiraciónes de rescate.'),
      buildPaso('Uso del DEA',
        'Encienda el DEA y siga las instrucciones de voz. Coloque parches en tórax desnudo. Asegúrese de que nadie toque al paciente durante el análisis y la descarga.',
        30, 'Use el desfibrilador siguiendo las instrucciones de voz.'),
      buildPaso('Continuar RCP',
        'Reanude RCP inmediatamente después de cada descarga. No se detenga hasta que el paciente se mueva, llegue ayuda médica o esté agotado.',
        60, 'Continúe RCP sin detenerse hasta que llegue ayuda.')
    ]
  }
];

async function run() {
  try {
    const hashedPassword = await bcrypt.hash(MEDICO.password, 10);

    db.get('SELECT id FROM medicos WHERE cedula = ? OR id_medico = ?', [MEDICO.cedula, MEDICO.id_medico], (err, row) => {
      if (err) {
        console.error('Error al verificar médico:', err.message);
        process.exit(1);
      }

      if (row) {
        console.log(`Medico "${MEDICO.nombre}" ya existe (id=${row.id}). Saltando...`);
        insertInstrucciones(0);
      } else {
        db.run(
          'INSERT INTO medicos (nombre, email, cedula, especializacion, id_medico, password) VALUES (?, ?, ?, ?, ?, ?)',
          [MEDICO.nombre, MEDICO.email, MEDICO.cedula, MEDICO.especializacion, MEDICO.id_medico, hashedPassword],
          function (err) {
            if (err) {
              console.error('Error al insertar médico:', err.message);
              process.exit(1);
            }
            console.log(`Medico "${MEDICO.nombre}" creado (id=${this.lastID}).`);
            insertInstrucciones(0);
          }
        );
      }
    });

    function insertInstrucciones(index) {
      if (index >= INSTRUCCIONES.length) {
        console.log('Seed completado exitosamente.');
        process.exit(0);
        return;
      }

      const inst = INSTRUCCIONES[index];

      db.get('SELECT id FROM instrucciones WHERE titulo = ?', [inst.titulo], (err, row) => {
        if (err) {
          console.error('Error al verificar instrucción:', err.message);
          process.exit(1);
        }

        if (row) {
          console.log(`Instruccion "${inst.titulo}" ya existe. Saltando...`);
          insertInstrucciones(index + 1);
        } else {
          const fecha = new Date().toISOString();
          const idM = MEDICO.id_medico;
          db.run(
            'INSERT INTO instrucciones (titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, fecha, id_medico, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [inst.titulo, inst.categoria, inst.severidad, inst.parte_cuerpo, inst.tiempo_estimado, JSON.stringify(inst.pasos), fecha, idM, inst.descripcion || null],
            function (err) {
              if (err) {
                console.error('Error al insertar instrucción:', err.message);
                process.exit(1);
              }
              console.log(`Instruccion "${inst.titulo}" creada (id=${this.lastID}).`);
              insertInstrucciones(index + 1);
            }
          );
        }
      });
    }
  } catch (err) {
    console.error('Error en seed:', err.message);
    process.exit(1);
  }
}

run();
