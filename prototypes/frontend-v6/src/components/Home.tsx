// Inicio (1A): datos estáticos por props. No sortea el subtítulo; no tiene inputs.
import playIcon from '../assets/icons/play.svg?url';

export type HomeSummary = {message: string; actionLabel: string};
export type HomeProps = {
  preferredName: string;
  subtitle: string;
  summary: HomeSummary;
  onOpenShift: () => void;
};

export function Home({preferredName, subtitle, summary, onOpenShift}: HomeProps) {
  const name = preferredName.trim();
  const greeting = name ? `Hola, ${name}.` : 'Hola.';
  const iconStyle = {maskImage: `url(${JSON.stringify(playIcon)})`, WebkitMaskImage: `url(${JSON.stringify(playIcon)})`};
  return (
    <main id="main" tabIndex={-1} className="home">
      <div className="greeting">
        <h1>{greeting}</h1>
        <p>{subtitle}</p>
        <div className="home-summary">
          <p>{summary.message}</p>
          <button type="button" className="primary" data-focus-key="home-primary" onClick={onOpenShift}>
            <i className="icon" aria-hidden="true" style={iconStyle} />
            <span>{summary.actionLabel}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
