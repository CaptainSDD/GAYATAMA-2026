import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Small print beside the title — a weight, a radius, a count. */
  note?: ReactNode;
  children: ReactNode;
}

/** Gives the panel rhythm: without it the analysis reads as one wall of text. */
export function Card({ title, note, children }: CardProps) {
  return (
    <section className="card">
      {title !== undefined && (
        <h3 className="card-title">
          <span>{title}</span>
          {note !== undefined && <span className="muted">{note}</span>}
        </h3>
      )}
      {children}
    </section>
  );
}
