import { DIA, HORA, L, noches, serie, type Escenario } from './modelo';

/** Escenarios del entorno cerrado: atmósfera, ruido y microbios. */
export const ESCENARIOS_ENTORNO: Escenario[] = [
  {
    id: 'hipoxia-cabina', nombre: 'Cabina de exploración a baja presión', categoria: 'entorno',
    descripcion: 'En Marte la cabina se mantiene parcialmente despresurizada: un dolor de cabeza completa el cuadro.',
    hrp: ['hipoxia'], peligros: ['entorno'], nivelMaximo: 'aviso',
    queObservar: ['Un síntoma solo no alarma.', 'Dos síntomas de la lista de la NASA con oxígeno justo: posible hipoxia leve.', 'El texto la compara con el mal de altura.'],
    contextoInicial: { destino: 'marte', diaMision: 60 },
    precarga: (t) => [...serie('spo2', [93, 92, 93], t - HORA, 2 * HORA), ...noches([5.5, 5, 5.5], t)],
    pasos: [
      { enMs: 0, titulo: 'Cabina a 18,5 kPa', narracion: 'El hábitat informa la presión parcial de oxígeno.', lecturas: (t) => [L('ppO2Cabina', 18.5, t)], esperado: [{ riesgoId: 'hipoxia.cabina', nivel: 'normal' }] },
      { enMs: 8_000, titulo: 'Dolor de cabeza', narracion: 'Lo cuenta en la conversación: con el sueño corto, son dos síntomas.', frase: 'me duele la cabeza', esperado: [{ riesgoId: 'hipoxia.cabina', nivel: 'aviso' }] },
    ],
  },
  {
    id: 'ruido-noche', nombre: 'Ventilador ruidoso de madrugada', categoria: 'entorno',
    descripcion: 'A las 3:00 un ventilador marca 64 dBA. El aviso espera a que despierte.',
    hrp: ['sueno'], peligros: ['entorno'], nivelMaximo: 'aviso',
    queObservar: ['En horario de sueño el umbral es más bajo.', 'El aviso se retiene: no lo despierta por algo que no es urgente.'],
    contextoInicial: { hora: 3 },
    pasos: [
      { enMs: 0, titulo: '64 dBA a las 3:00', narracion: 'El sensor de ruido del módulo registra 64 dBA.', lecturas: (t) => [L('ruidoCabina', 64, t)], esperado: [{ riesgoId: 'entorno.ruido', nivel: 'aviso' }] },
      { enMs: 8_000, titulo: 'Despierta', narracion: 'Son las 8:00: Higia entrega el aviso retenido.', contexto: { hora: 8 }, esperado: [{ riesgoId: 'entorno.ruido', nivel: 'normal' }] },
    ],
  },
  {
    id: 'agua-contaminada', nombre: 'Hisopado del agua en aumento', categoria: 'entorno',
    descripcion: 'La carga microbiana del agua sube; después aparecen síntomas digestivos y fiebre.',
    hrp: ['microorganismos', 'inmune'], peligros: ['entorno'], nivelMaximo: 'alerta',
    queObservar: ['Vigila la tendencia, no un valor aislado.', 'Info, luego aviso, luego alerta, a medida que se suman señales.'],
    precarga: (t) => serie('cargaMicrobiana', [20, 25], t - 3 * DIA, 3 * DIA),
    pasos: [
      { enMs: 0, titulo: 'Nuevo hisopado', narracion: 'El agua da 130 UFC: tercera muestra en aumento.', lecturas: (t) => [L('cargaMicrobiana', 130, t)], esperado: [{ riesgoId: 'microbioma.entorno', nivel: 'info' }] },
      { enMs: 8_000, titulo: 'Diarrea', narracion: 'Cuenta síntomas digestivos.', frase: 'tengo diarrea', esperado: [{ riesgoId: 'microbioma.entorno', nivel: 'aviso' }] },
      { enMs: 16_000, titulo: 'Fiebre', narracion: '38,4 °C: la infección es probable.', lecturas: (t) => [L('temperatura', 38.4, t)], esperado: [{ riesgoId: 'microbioma.entorno', nivel: 'alerta' }, { riesgoId: 'inmune.fiebre', nivel: 'aviso' }] },
    ],
  },
];
