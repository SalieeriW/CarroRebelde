import "../styles/game.css";

export const metadata = { title: "Rope Coop Online" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="pixel-bg" />
        {children}
      </body>
    </html>
  );
}
