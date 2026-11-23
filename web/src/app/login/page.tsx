import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PageBackground from "@/components/PageBackground";
import Proximamente from "@/components/Proximamente";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <PageBackground fondo="home">
      <Header>
        <Link href="/" className="btn-outline px-4 py-2">Volver</Link>
      </Header>
      <Proximamente titulo="Iniciar sesión" fase="fase 2 (login y roles)" />
      <Footer />
    </PageBackground>
  );
}
