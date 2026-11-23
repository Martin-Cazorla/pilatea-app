import { FaInstagram, FaWhatsapp } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="mt-auto w-full bg-footer px-[5%] pb-1 pt-4 text-center text-white">
      <p className="mb-1 text-sm">
        <strong>Estudio Pilatea</strong> | Miguel Soler 311 | Contacto: +54 9 11 25922054
      </p>
      <div className="mb-2 flex justify-center gap-6">
        <a
          href="https://instagram.com/tucuenta"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="text-[2rem] text-[#e1306c] transition-transform duration-300 hover:scale-120"
        >
          <FaInstagram />
        </a>
        <a
          href="https://wa.me/5491125922054"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="text-[2rem] text-exito transition-transform duration-300 hover:scale-120"
        >
          <FaWhatsapp />
        </a>
      </div>
      <p className="pt-1 text-[0.65rem]">&copy; 2026 Cazorla Estudio - Todos los derechos reservados.</p>
    </footer>
  );
}
