import TabBar from '@/components/TabBar';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-app-dark text-white min-h-screen">
        <main className="pb-32"> {/* Padding bottom pour ne pas cacher le contenu derrière la TabBar */}
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  );
}