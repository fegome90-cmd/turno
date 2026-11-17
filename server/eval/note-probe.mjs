// Written blind on 2026-11-12 before any run.
const mk = (n, text) =>
  Object.freeze({
    id: `probe-${String(n).padStart(2, '0')}`,
    group: 'probe-conditional',
    text,
    expect: 'abstain',
    oracleLabel: 'NEEDS_REVIEW',
  });

export const NOTE_PROBE = Object.freeze([
  mk(1, 'Cuando confirmen la fecha de la auditoría, hay que imprimir las planillas de inventario y dejarlas en la sala 3.'),
  mk(2, 'Reponer las cajas de mascarillas del pasillo B, pero solo si sobra tiempo antes del cambio de turno.'),
  mk(3, 'En caso de que el técnico no alcance a venir, tocaría llamar a otro proveedor para arreglar el carro de insumos.'),
  mk(4, 'Igual podríamos rotular las bolsas de lavandería nuevas, no sé, depende de si la jefa de turno trae los marcadores.'),
  mk(5, 'Tal vez mañana convenga cambiar las llaves de la bodega chica y avisar a todos, aún no sé si autorizan el gasto.'),
  mk(6, 'Si el ascensor sigue malo después del mediodía, yo diría que hay que subir los carros por la escalera y reagendar el retiro de sábanas.'),
].map((o) => o));
