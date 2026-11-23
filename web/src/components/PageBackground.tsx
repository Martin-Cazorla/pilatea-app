const fondos = {
  home: "/img/home-bg2.jpg",
  reserva: "/img/1000294795.jpg",
  admin: "/img/admin-bg.jpg",
} as const;

type Props = {
  fondo: keyof typeof fondos;
  children: React.ReactNode;
};

/** Página con la foto de fondo y el velo blanco al 50% del sitio actual. */
export default function PageBackground({ fondo, children }: Props) {
  return (
    <div
      className="flex min-h-screen flex-col bg-cover bg-top bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5)), url('${fondos[fondo]}')`,
      }}
    >
      {children}
    </div>
  );
}
