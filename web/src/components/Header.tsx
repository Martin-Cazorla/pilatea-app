import Image from "next/image";
import Link from "next/link";

type Props = {
  /** Botones o links de la derecha. Por defecto: login de alumno y acceso staff. */
  children?: React.ReactNode;
};

export default function Header({ children }: Props) {
  return (
    <header className="flex w-full items-center justify-between gap-4 bg-crema px-[5%] py-4 shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
      <Link href="/" aria-label="Pilatea, inicio">
        <Image
          src="/img/logo-pilatea-removebg-preview.png"
          alt="Logo Pilatea"
          width={120}
          height={50}
          priority
          className="h-[50px] w-auto transition-transform duration-300 hover:scale-105"
        />
      </Link>
      <nav className="flex items-center gap-3 sm:gap-5">
        {children ?? (
          <>
            <Link href="/login" className="text-sm font-bold text-texto hover:text-principal">
              Iniciar Sesión
            </Link>
            <Link
              href="/admin"
              className="rounded-full border-[1.5px] border-principal px-4 py-2 text-sm font-medium text-principal transition-all duration-300 hover:bg-principal hover:text-white hover:shadow-[0_4px_12px_rgba(93,64,55,0.2)]"
            >
              Acceso Staff
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
