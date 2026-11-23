import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PageBackground from "@/components/PageBackground";
import Proximamente from "@/components/Proximamente";

export const metadata: Metadata = { title: "Panel de staff" };

export default function AdminPage() {
  return (
    <PageBackground fondo="admin">
      <Header>
        <Link href="/" className="btn-outline px-4 py-2">Volver al sitio</Link>
      </Header>
      <Proximamente titulo="Panel de staff" fase="fase 4 (gestión diaria y configuración)" />
      <Footer />
    </PageBackground>
  );
}
