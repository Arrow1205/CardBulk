import './globals.css';
import TabBar from '@/components/TabBar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#0F1115] text-white min-h-screen antialiased font-sans">
        <main className="pb-32">
          {children}
        </main>
        <TabBar />
      </body>
    </html>
  );
}