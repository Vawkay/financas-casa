import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist usa um "worker" carregado por caminho de arquivo em runtime, e
  // pdf2json é nativo do Node — empacotá-los quebra a resolução do worker
  // (".next/.../pdf.worker.mjs" inexistente). Mantemos via require nativo.
  serverExternalPackages: ["pdfjs-dist", "pdf2json"],
};

export default nextConfig;
