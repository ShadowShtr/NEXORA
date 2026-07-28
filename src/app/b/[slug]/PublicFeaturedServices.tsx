import Link from 'next/link';

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

export type FeaturedService = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
};

// A visitor deciding whether to even start the booking flow benefits from seeing a
// taste of the catalogue up front, rather than only finding out what's on offer after
// tapping "Fazer marcação" — same reasoning as the quick-actions row: reduce the
// number of steps before she trusts this is a real, active business worth booking.
export function PublicFeaturedServices({
  services,
  slug,
}: {
  services: FeaturedService[];
  slug: string;
}) {
  if (services.length === 0) return null;

  return (
    <section className="public-featured-services">
      <h2 className="public-section-title">Serviços populares</h2>
      <ul className="public-featured-service-list">
        {services.map((service) => (
          <li key={service.id} className="public-featured-service-row">
            <span className="public-featured-service-info">
              <span className="public-featured-service-name">{service.name}</span>
              <span className="public-featured-service-meta">{service.durationMinutes} min</span>
            </span>
            <span className="public-featured-service-price">{formatEuros(service.priceCents)}</span>
          </li>
        ))}
      </ul>
      <Link href={`/b/${slug}/servicos`} className="public-featured-services-link">
        Ver todos os serviços
      </Link>
    </section>
  );
}
