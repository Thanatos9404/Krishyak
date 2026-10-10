import { ArrowUpRight } from "lucide-react";
import { Photo } from "./Photo";
import { JsonLd } from "./JsonLd";
import { breadcrumbSchema } from "../../lib/seo";

export function PageIntro({
  eyebrow,
  title,
  description,
  photo,
  path,
  breadcrumb,
  cta = "Explore the demo",
  href = "/demo",
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: breadcrumb, href: path }])} />
      <section className="page-intro container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{breadcrumb}</span>
        </nav>
        <div className="intro-grid">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
            <a className="button primary" href={href}>
              {cta}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <figure>
            <Photo
              name={photo}
              priority
              sizes="(max-width: 760px) 100vw, 45vw"
            />
            <figcaption>
              Illustrative photography. No farmer account is shown.
            </figcaption>
          </figure>
        </div>
      </section>
    </>
  );
}
