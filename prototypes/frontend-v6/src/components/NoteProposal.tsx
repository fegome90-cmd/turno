// Bloque inline bajo la nota guardada (R5b-T08). Sin aviso, sin diálogo automático y sin foco robado.

export function NoteProposalBlock({title, onReview, onDismiss}: {title: string; onReview(): void; onDismiss(): void}) {
  return <section className="note-proposal" aria-label="Propuesta de tarea">
    <p>¿Agregar “{title}” a tareas?</p>
    <div className="note-proposal-actions">
      <button type="button" onClick={onDismiss}>Descartar</button>
      <button type="button" className="primary" onClick={onReview}>Revisar tarea</button>
    </div>
  </section>;
}
