import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PageBackground from "@/components/PageBackground";
import { DISCIPLINAS } from "@/lib/disciplinas";

export default function Home() {
  return (
    <PageBackground fondo="home">
      <Header />
      <main className="flex flex-1 flex-col items-center px-[5%] py-16">
        <h1 className="mb-10 text-center font-titulo text-3xl font-bold text-acento">Elegí tu clase de Pilates</h1>
        <div className="flex w-full max-w-[1200px] flex-wrap justify-center gap-8">
          {DISCIPLINAS.map((d) => (
            <article
              key={d.id}
              className="flex w-full max-w-[350px] flex-col rounded-2xl bg-crema px-8 py-10 text-center shadow-[0_10px_25px_rgba(0,0,0,0.1)]"
            >
              <h2 className="mb-3 font-titulo text-xl font-bold text-principal">{d.nombre}</h2>
              <p className="mb-6 flex-1 text-suave">{d.descripcion}</p>
              <Link href={`/login?clase=${d.id}`} className="btn-primary w-full py-4">
                Reservar Clase
              </Link>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </PageBackground>
  );
}
