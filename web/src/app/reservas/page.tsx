import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PageBackground from "@/components/PageBackground";
import Proximamente from "@/components/Proximamente";

export const metadata: Metadata = { title: "Reservas" };

export default function ReservasPage() {
  return (
    <PageBackground fondo="reserva">
      <Header>
        <Link href="/" className="btn-outline px-4 py-2">Volver</Link>
      </Header>
      <Proximamente titulo="Reservar clase" fase="fase 3 (reservas del alumno)" />
      <Footer />
    </PageBackground>
  );
}
