import provenance from "../../../public/asset-provenance.json";

export function Photo({
  name,
  className = "",
  priority = false,
  decorative = false,
  sizes = "(max-width: 600px) 100vw, 50vw",
}) {
  const photo = provenance.photos.find((row) => row.name === name);
  if (!photo) throw new Error(`Unknown licensed photo: ${name}`);
  const medium = photo.sizes[1];
  return (
    <img
      className={className}
      src={medium.src}
      srcSet={photo.sizes.map((row) => `${row.src} ${row.width}w`).join(", ")}
      sizes={sizes}
      width={medium.width}
      height={medium.height}
      alt={decorative ? "" : photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
