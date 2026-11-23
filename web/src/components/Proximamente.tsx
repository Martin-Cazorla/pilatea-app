type Props = { titulo: string; fase: string; children?: React.ReactNode };

/** Lugar reservado para las pantallas que llegan en fases siguientes. */
export default function Proximamente({ titulo, fase, children }: Props) {
  return (
    <main className="flex flex-1 items-center justify-center px-[5%] py-16">
      <div className="w-full max-w-md rounded-2xl bg-crema p-10 text-center shadow-[0_10px_25px_rgba(0,0,0,0.1)]">
        <h1 className="mb-3 font-titulo text-2xl font-bold text-principal">{titulo}</h1>
        <p className="text-suave">Esta pantalla se migra en la {fase}.</p>
        {children}
      </div>
    </main>
  );
}
